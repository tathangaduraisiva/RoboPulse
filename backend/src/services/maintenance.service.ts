import { pool } from "../db/postgres.js";
import {
    invalidateRobotPredictionCache,
    evaluateRobotTelemetry,
    recordHandledCondition,
    getCurrentConditionFingerprint,
} from "./predictionEngine.js";
import { syncRobotStatus } from "./robot.service.js";

export interface MaintenanceRecord {
    id: string;
    robot_id: string;
    robot_name: string;
    robot_serial: string;
    robot_model: string;
    line_name: string;
    component_id: string | null;
    component_name: string | null;
    maintenance_type: "preventive" | "corrective" | "inspection" | "component_replacement";
    description: string;
    technician: string | null;
    cost: number | null;
    performed_at: string;
    next_due_at: string | null;
    created_at: string;
    status: "upcoming" | "overdue" | "completed";
}

export interface CreateMaintenanceDTO {
    robot_id: string;
    component_id?: string;
    maintenance_type: "preventive" | "corrective" | "inspection" | "component_replacement";
    description: string;
    technician?: string;
    cost?: number;
    next_due_at?: string;
    /** Optional: condition fingerprint supplied by the caller (e.g. from diagnosis flow) */
    condition_fingerprint?: string;
}

export async function getAllMaintenance(): Promise<MaintenanceRecord[]> {
    const query = `
        SELECT 
            m.id,
            m.robot_id,
            r.name AS robot_name,
            r.serial_number AS robot_serial,
            r.model AS robot_model,
            COALESCE(pl.name, 'Unassigned') AS line_name,
            m.component_id,
            c.name AS component_name,
            m.maintenance_type,
            m.description,
            m.technician,
            m.cost,
            m.performed_at,
            m.next_due_at,
            m.created_at,
            CASE
                WHEN m.next_due_at IS NOT NULL AND m.next_due_at < NOW() THEN 'overdue'
                WHEN m.next_due_at IS NOT NULL AND m.next_due_at >= NOW() THEN 'upcoming'
                ELSE 'completed'
            END AS status
        FROM maintenance_records m
        JOIN robots r ON m.robot_id = r.id
        LEFT JOIN production_lines pl ON r.line_id = pl.id
        LEFT JOIN components c ON m.component_id = c.id
        ORDER BY 
            COALESCE(m.next_due_at, m.performed_at) ASC;
    `;
    const result = await pool.query(query);
    return result.rows;
}

export async function createMaintenance(dto: CreateMaintenanceDTO): Promise<MaintenanceRecord> {
    const query = `
        INSERT INTO maintenance_records (
            robot_id,
            component_id,
            maintenance_type,
            description,
            technician,
            cost,
            performed_at,
            next_due_at,
            condition_fingerprint
        ) VALUES (
            $1, $2, $3, $4, $5, $6, NOW(), $7, $8
        )
        RETURNING *;
    `;
    const result = await pool.query(query, [
        dto.robot_id,
        dto.component_id || null,
        dto.maintenance_type,
        dto.description,
        dto.technician || "Fleet Tech Team",
        dto.cost || 0,
        dto.next_due_at || null,
        dto.condition_fingerprint || null,
    ]);
    const record = result.rows[0];

    // Trigger maintenance feedback loop: Invalidate cache, sync robot status, and recalculate prediction
    if (record?.robot_id) {
        await syncRobotStatus(record.robot_id).catch((err) => {
            console.warn(`[Maintenance] Robot status sync failed for robot ${record.robot_id}:`, err);
        });
        await invalidateRobotPredictionCache(record.robot_id);
        evaluateRobotTelemetry(record.robot_id).catch((err) => {
            console.warn(`[Maintenance] Background prediction recalculation error:`, err);
        });
    }

    return record;
}

export async function markMaintenanceComplete(id: string): Promise<MaintenanceRecord | null> {
    // Step 1: Fetch the maintenance record to get robot_id before updating
    const fetchResult = await pool.query(
        `SELECT id, robot_id, condition_fingerprint FROM maintenance_records WHERE id = $1;`,
        [id]
    );
    if (fetchResult.rows.length === 0) return null;
    const existingRecord = fetchResult.rows[0];
    const robotId: string = existingRecord.robot_id;

    // Step 2: Capture the current condition fingerprint from live telemetry
    const currentCondition = await getCurrentConditionFingerprint(robotId);

    // Step 3: Mark the maintenance record as complete and stamp the condition_handled_at timestamp
    const updateQuery = `
        UPDATE maintenance_records
        SET 
            performed_at = NOW(),
            next_due_at = NULL,
            condition_handled_at = NOW(),
            condition_fingerprint = COALESCE(condition_fingerprint, $2)
        WHERE id = $1
        RETURNING *;
    `;
    const result = await pool.query(updateQuery, [
        id,
        currentCondition?.fingerprint ?? null,
    ]);
    if (result.rows.length === 0) return null;
    const record = result.rows[0];

    // Step 4: Record the handled condition so the prediction engine can suppress stale re-detections
    if (currentCondition && currentCondition.category !== "normal") {
        await recordHandledCondition(
            robotId,
            record.id,
            currentCondition.fingerprint,
            currentCondition.category,
            currentCondition.telemetry,
            currentCondition.latestReadingAt ?? undefined
        );
    } else if (existingRecord.condition_fingerprint) {
        await recordHandledCondition(
            robotId,
            record.id,
            existingRecord.condition_fingerprint,
            "handled_at_schedule",
            {},
            undefined
        );
    }

    // Step 5: Resolve all open alerts for this robot that match the handled condition fingerprint.
    await resolveHandledAlerts(robotId, currentCondition?.fingerprint ?? null);

    // Step 6: Synchronize robot status, invalidate Redis cache and recalculate prediction fresh
    await syncRobotStatus(robotId).catch((err) => {
        console.warn(`[Maintenance] Robot status sync failed for robot ${robotId}:`, err);
    });
    await invalidateRobotPredictionCache(robotId);
    evaluateRobotTelemetry(robotId).catch((err) => {
        console.warn(`[Maintenance] Background prediction recalculation error:`, err);
    });

    return record;
}

/**
 * Resolves all open/in-progress alerts for a robot after maintenance completion.
 * This prevents unresolved alerts from inflating the error score and recreating
 * the same critical condition through the alert-based path.
 *
 * Only resolves alerts that are in resolvable states (new, acknowledged, in_progress).
 * Does NOT touch alerts that were already resolved before maintenance.
 */
async function resolveHandledAlerts(robotId: string, _conditionFingerprint: string | null): Promise<void> {
    try {
        const resolveResult = await pool.query(
            `UPDATE alerts
             SET status = 'resolved', updated_at = NOW()
             WHERE robot_id = $1
               AND status IN ('new', 'acknowledged', 'in_progress', 'open', 'investigating')
             RETURNING id, type, severity;`,
            [robotId]
        );
        if (resolveResult.rows.length > 0) {
            console.log(
                `[Maintenance] Resolved ${resolveResult.rows.length} alert(s) for robot ${robotId} upon maintenance completion:`,
                resolveResult.rows.map((r: { id: string; type: string; severity: string }) => `${r.type}/${r.severity}`).join(", ")
            );
        }
    } catch (err) {
        console.warn(`[Maintenance] Could not resolve alerts for robot ${robotId}:`, err);
    }
}
