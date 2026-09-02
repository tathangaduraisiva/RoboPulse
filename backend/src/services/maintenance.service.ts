import { pool } from "../db/postgres.js";

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
            next_due_at
        ) VALUES (
            $1, $2, $3, $4, $5, $6, NOW(), $7
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
    ]);
    return result.rows[0];
}

export async function markMaintenanceComplete(id: string): Promise<MaintenanceRecord | null> {
    const query = `
        UPDATE maintenance_records
        SET performed_at = NOW(), next_due_at = NULL
        WHERE id = $1
        RETURNING *;
    `;
    const result = await pool.query(query, [id]);
    if (result.rows.length === 0) return null;
    return result.rows[0];
}
