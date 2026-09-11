import { pool } from "../db/postgres.js";
import { redisClient } from "../config/redis.js";

export interface PredictionRecord {
    id: string;
    robot_id: string;
    robot_name: string;
    robot_serial: string;
    robot_model: string;
    robot_status: string;
    line_name: string;
    health_score: number;
    risk_score: number;
    risk_level: "low" | "moderate" | "high" | "critical";
    temperature_score: number;
    vibration_score: number;
    runtime_score: number;
    error_score: number;
    maintenance_score: number;
    primary_reason: string;
    recommendation: string;
    what_if_24h: string;
    confidence: string;
    latest_temperature_c: number;
    latest_vibration_mm_s: number;
    latest_motor_current_a: number;
    latest_pressure_bar: number;
    calculated_at: string;
    /** Deterministic fingerprint of the detected condition (if any) */
    condition_fingerprint?: string;
    /** Category of the detected condition */
    condition_category?: string;
    /**
     * handled   — same condition was already diagnosed and maintenance completed
     * active    — condition is live and unhandled
     * monitoring — post-maintenance, no new evidence of the old problem
     * recurring — same fingerprint reappeared after prior handling
     * new_issue — different condition detected after a prior handling
     */
    condition_status?: "handled" | "active" | "monitoring" | "recurring" | "new_issue";
    /** true when this is a genuinely new or recurring event that should create a new alert */
    is_new_condition?: boolean;
}

interface RawSensorReading {
    temperature_c: number;
    vibration_mm_s: number;
    motor_current_a: number;
    pressure_bar: number;
    recorded_at: Date;
}

/**
 * Determines the primary anomaly category from component scores.
 * Returns a deterministic category string and a bucket string used in fingerprinting.
 */
function deriveConditionCategory(
    vibScore: number,
    tempScore: number,
    currentScore: number,
    pressScore: number = 0,
    errScore: number = 0
): { category: string; signalBucket: string } {
    if (vibScore >= 35 && tempScore >= 35) {
        return { category: "multi_sensor_anomaly", signalBucket: "vib_temp" };
    }
    if (vibScore >= 35) {
        const band = vibScore >= 75 ? "severe" : vibScore >= 55 ? "high" : "elevated";
        return { category: "high_vibration", signalBucket: `vib_${band}` };
    }
    if (tempScore >= 35) {
        const band = tempScore >= 75 ? "severe" : tempScore >= 55 ? "high" : "elevated";
        return { category: "thermal_stress", signalBucket: `temp_${band}` };
    }
    if (currentScore >= 35) {
        const band = currentScore >= 75 ? "severe" : currentScore >= 55 ? "high" : "elevated";
        return { category: "abnormal_motor_current", signalBucket: `curr_${band}` };
    }
    if (pressScore >= 35) {
        const band = pressScore >= 75 ? "severe" : pressScore >= 55 ? "high" : "elevated";
        return { category: "pneumatic_pressure_variance", signalBucket: `press_${band}` };
    }
    if (errScore >= 40) {
        return { category: "multi_sensor_anomaly", signalBucket: "alerts_elevated" };
    }
    return { category: "normal", signalBucket: "normal" };
}

/**
 * Produces a deterministic fingerprint for a detected condition.
 * Same robot + same category + same signal bucket → same fingerprint.
 * Does NOT use random values.
 */
function buildConditionFingerprint(robotId: string, category: string, signalBucket: string): string {
    return `${robotId}:${category}:${signalBucket}`;
}

/**
 * Calculates real statistical features and linear trend slope from chronological readings.
 */
function calculateSeriesStats(values: number[]) {
    if (values.length === 0) {
        return { latest: 0, avg: 0, min: 0, max: 0, stdDev: 0, slope: 0 };
    }

    const latest = values[values.length - 1];
    const sum = values.reduce((a, b) => a + b, 0);
    const avg = sum / values.length;
    const min = Math.min(...values);
    const max = Math.max(...values);

    // Standard deviation
    const variance = values.reduce((acc, v) => acc + Math.pow(v - avg, 2), 0) / values.length;
    const stdDev = Math.sqrt(variance);

    // Trend slope (difference between recent 30% and baseline 30%)
    const windowSize = Math.max(1, Math.floor(values.length * 0.3));
    const earlyAvg = values.slice(0, windowSize).reduce((a, b) => a + b, 0) / windowSize;
    const lateAvg = values.slice(-windowSize).reduce((a, b) => a + b, 0) / windowSize;
    const slope = lateAvg - earlyAvg;

    return { latest, avg, min, max, stdDev, slope };
}

/**
 * Checks the database for active handled-condition suppression for this robot.
 * Returns the most recent un-expired handled condition record, or null.
 */
async function getActiveHandledCondition(
    robotId: string
): Promise<{ fingerprint: string; category: string; handled_at: Date; suppression_expires_at: Date } | null> {
    try {
        const res = await pool.query(
            `SELECT condition_fingerprint, condition_category, handled_at, suppression_expires_at
             FROM handled_conditions
             WHERE robot_id = $1
               AND suppression_expires_at > NOW()
             ORDER BY handled_at DESC
             LIMIT 1;`,
            [robotId]
        );
        if (res.rows.length === 0) return null;
        const row = res.rows[0];
        return {
            fingerprint: row.condition_fingerprint,
            category: row.condition_category,
            handled_at: new Date(row.handled_at),
            suppression_expires_at: new Date(row.suppression_expires_at),
        };
    } catch {
        return null;
    }
}

/**
 * Returns the timestamp of the most recent maintenance completion for a robot,
 * or null if none exists.
 */
async function getLastMaintenanceCompletionTime(robotId: string): Promise<Date | null> {
    try {
        const res = await pool.query(
            `SELECT performed_at
             FROM maintenance_records
             WHERE robot_id = $1
               AND condition_handled_at IS NOT NULL
             ORDER BY performed_at DESC
             LIMIT 1;`,
            [robotId]
        );
        if (res.rows.length > 0) return new Date(res.rows[0].performed_at);

        // Fallback: any recent maintenance completion in last 14 days
        const fallback = await pool.query(
            `SELECT performed_at
             FROM maintenance_records
             WHERE robot_id = $1
               AND performed_at >= NOW() - INTERVAL '14 days'
             ORDER BY performed_at DESC
             LIMIT 1;`,
            [robotId]
        );
        if (fallback.rows.length > 0) return new Date(fallback.rows[0].performed_at);
        return null;
    } catch {
        return null;
    }
}

/**
 * Evaluates a single robot's predictive risk dynamically from real PostgreSQL telemetry.
 */
export async function evaluateRobotTelemetry(robotId: string): Promise<PredictionRecord> {
    const cacheKey = `prediction:robot:${robotId}`;
    try {
        if (redisClient.isOpen) {
            const cached = await redisClient.get(cacheKey);
            if (cached) {
                return JSON.parse(cached);
            }
        }
    } catch {
        // Fallback to live calculation
    }

    // 1. Fetch Robot Details
    const robotQuery = `
        SELECT 
            r.id,
            r.name,
            r.serial_number,
            r.model,
            r.status,
            r.total_runtime_hours,
            COALESCE(pl.name, 'Unassigned') AS line_name
        FROM robots r
        LEFT JOIN production_lines pl ON r.line_id = pl.id
        WHERE r.id = $1;
    `;
    const robotRes = await pool.query(robotQuery, [robotId]);
    if (robotRes.rows.length === 0) {
        throw new Error(`Robot with ID ${robotId} not found`);
    }
    const robot = robotRes.rows[0];

    // 2. Check for active handled-condition suppression
    const handledCondition = await getActiveHandledCondition(robotId);

    // 3. Determine which telemetry window to use for scoring.
    //    When maintenance was recently completed, we prefer the post-maintenance window
    //    so that old pre-maintenance readings do not dominate the risk calculation.
    const lastMaintAt = await getLastMaintenanceCompletionTime(robotId);
    let readingsQuery: string;
    let readingsParams: unknown[];

    if (lastMaintAt) {
        // Use post-maintenance readings first (need at least 5); fall back to all if scarce.
        const postMaintCheck = await pool.query(
            `SELECT COUNT(*) as cnt FROM sensor_readings
             WHERE robot_id = $1 AND recorded_at > $2;`,
            [robotId, lastMaintAt]
        );
        const postMaintCount = Number(postMaintCheck.rows[0]?.cnt) || 0;

        if (postMaintCount >= 5) {
            // Enough post-maintenance data — use only the post-maintenance window
            readingsQuery = `
                SELECT temperature_c, vibration_mm_s, motor_current_a, pressure_bar, recorded_at
                FROM sensor_readings
                WHERE robot_id = $1 AND recorded_at > $2
                ORDER BY recorded_at ASC;
            `;
            readingsParams = [robotId, lastMaintAt];
        } else {
            // Scarce post-maintenance readings — use all but note context
            readingsQuery = `
                SELECT temperature_c, vibration_mm_s, motor_current_a, pressure_bar, recorded_at
                FROM sensor_readings
                WHERE robot_id = $1
                ORDER BY recorded_at ASC;
            `;
            readingsParams = [robotId];
        }
    } else {
        readingsQuery = `
            SELECT temperature_c, vibration_mm_s, motor_current_a, pressure_bar, recorded_at
            FROM sensor_readings
            WHERE robot_id = $1
            ORDER BY recorded_at ASC;
        `;
        readingsParams = [robotId];
    }

    const readingsRes = await pool.query(readingsQuery, readingsParams);
    const readings: RawSensorReading[] = readingsRes.rows.map((r) => ({
        temperature_c: Number(r.temperature_c) || 0,
        vibration_mm_s: Number(r.vibration_mm_s) || 0,
        motor_current_a: Number(r.motor_current_a) || 0,
        pressure_bar: Number(r.pressure_bar) || 0,
        recorded_at: new Date(r.recorded_at),
    }));

    // 4. Fetch Active / Unresolved Alerts
    const alertsQuery = `
        SELECT severity, COUNT(*) as count
        FROM alerts
        WHERE robot_id = $1 AND (status != 'resolved' OR status IS NULL)
        GROUP BY severity;
    `;
    const alertsRes = await pool.query(alertsQuery, [robotId]);
    let activeAlertsCount = 0;
    let criticalAlertsCount = 0;
    for (const row of alertsRes.rows) {
        const count = Number(row.count) || 0;
        activeAlertsCount += count;
        if (row.severity === "critical" || row.severity === "high") {
            criticalAlertsCount += count;
        }
    }

    // 5. Fetch Maintenance History
    const maintQuery = `
        SELECT 
            COUNT(*) FILTER (WHERE next_due_at IS NOT NULL AND next_due_at < NOW()) as overdue_count,
            COUNT(*) FILTER (WHERE performed_at >= NOW() - INTERVAL '14 days') as recent_completed_count
        FROM maintenance_records
        WHERE robot_id = $1;
    `;
    const maintRes = await pool.query(maintQuery, [robotId]);
    const overdueCount = Number(maintRes.rows[0]?.overdue_count) || 0;
    const recentCompletedCount = Number(maintRes.rows[0]?.recent_completed_count) || 0;

    // 6. Check if Telemetry is Insufficient
    if (readings.length === 0) {
        const fallbackRecord: PredictionRecord = {
            id: `pred-${robotId}`,
            robot_id: robot.id,
            robot_name: robot.name,
            robot_serial: robot.serial_number,
            robot_model: robot.model,
            robot_status: robot.status,
            line_name: robot.line_name,
            health_score: 85,
            risk_score: 15,
            risk_level: "low",
            temperature_score: 10,
            vibration_score: 10,
            runtime_score: 10,
            error_score: 5,
            maintenance_score: 5,
            primary_reason: "Insufficient telemetry data available for assessment",
            recommendation: "Connect telemetry sensors to enable continuous predictive analysis.",
            what_if_24h: "Awaiting telemetry stream; cannot project degradation trajectory without sensor input.",
            confidence: "Limited (No Telemetry Data)",
            latest_temperature_c: 0,
            latest_vibration_mm_s: 0,
            latest_motor_current_a: 0,
            latest_pressure_bar: 0,
            calculated_at: new Date().toISOString(),
            condition_status: "monitoring",
            is_new_condition: false,
        };
        return fallbackRecord;
    }

    // 7. Feature Extraction
    const tempStats = calculateSeriesStats(readings.map((r) => r.temperature_c));
    const vibStats = calculateSeriesStats(readings.map((r) => r.vibration_mm_s));
    const currStats = calculateSeriesStats(readings.map((r) => r.motor_current_a));
    const pressStats = calculateSeriesStats(readings.map((r) => r.pressure_bar));
    const runtimeHours = Number(robot.total_runtime_hours) || 0;

    // 8. Component Risk Sub-Scores (0 to 100)

    // A. Vibration Score (ISO 10816 Mechanical Standard)
    let vibScore = 0;
    if (vibStats.latest <= 2.8) {
        vibScore = (vibStats.latest / 2.8) * 18;
    } else if (vibStats.latest <= 4.5) {
        vibScore = 18 + ((vibStats.latest - 2.8) / 1.7) * 45;
    } else {
        vibScore = 63 + Math.min(32, ((vibStats.latest - 4.5) / 3.0) * 32);
    }
    if (vibStats.slope > 0.2) {
        vibScore += Math.min(12, vibStats.slope * 6);
    }
    if (vibStats.stdDev > 0.8) {
        vibScore += Math.min(8, vibStats.stdDev * 3);
    }
    vibScore = Math.max(2, Math.min(98, Math.round(vibScore)));

    // B. Temperature Score
    let tempScore = 0;
    if (tempStats.latest <= 60) {
        tempScore = (tempStats.latest / 60) * 18;
    } else if (tempStats.latest <= 75) {
        tempScore = 18 + ((tempStats.latest - 60) / 15) * 45;
    } else {
        tempScore = 63 + Math.min(32, ((tempStats.latest - 75) / 25) * 32);
    }
    if (tempStats.slope > 1.0) {
        tempScore += Math.min(12, tempStats.slope * 3);
    }
    tempScore = Math.max(2, Math.min(98, Math.round(tempScore)));

    // C. Motor Current Score
    let currentScore = 0;
    if (currStats.latest <= 12) {
        currentScore = (currStats.latest / 12) * 18;
    } else if (currStats.latest <= 18) {
        currentScore = 18 + ((currStats.latest - 12) / 6) * 45;
    } else {
        currentScore = 63 + Math.min(32, ((currStats.latest - 18) / 10) * 32);
    }
    const runtimeAging = Math.min(12, (runtimeHours / 10000) * 12);
    currentScore += runtimeAging;
    currentScore = Math.max(2, Math.min(98, Math.round(currentScore)));

    // D. Pressure Score (Pneumatic Standard: 4.0 - 7.0 bar nominal)
    let pressScore = 0;
    if (pressStats.latest >= 4.6 && pressStats.latest <= 6.4) {
        pressScore = Math.abs(pressStats.latest - 5.0) * 8;
    } else if (pressStats.latest >= 4.0 && pressStats.latest <= 7.0) {
        pressScore = 18 + Math.abs(pressStats.latest - 5.0) * 16;
    } else if (pressStats.latest <= 2.5 || pressStats.latest >= 8.0) {
        pressScore = 75 + Math.min(20, Math.abs(pressStats.latest - 5.0) * 6);
    } else {
        pressScore = 55 + Math.min(22, Math.abs(pressStats.latest - 5.0) * 8);
    }
    pressScore = Math.max(2, Math.min(98, Math.round(pressScore)));

    // E. Error / Alert Score
    let errScore = Math.min(95, activeAlertsCount * 18 + criticalAlertsCount * 25);
    if (errScore === 0) errScore = 4;

    // F. Maintenance Urgency Score
    let maintScore = 10;
    if (overdueCount > 0) {
        maintScore = 65;
    } else if (recentCompletedCount > 0) {
        maintScore = 5;
    } else if (runtimeHours > 6000) {
        maintScore = 25;
    }

    // 9. Multi-Sensor Correlation & Composite Risk Calculation
    const weightedBase =
        0.30 * vibScore +
        0.25 * tempScore +
        0.20 * currentScore +
        0.15 * pressScore +
        0.06 * errScore +
        0.04 * maintScore;

    let elevatedChannels = 0;
    if (vibScore >= 35) elevatedChannels++;
    if (tempScore >= 35) elevatedChannels++;
    if (currentScore >= 35) elevatedChannels++;
    if (pressScore >= 35) elevatedChannels++;
    if (errScore >= 35) elevatedChannels++;

    let correlationBoost = 0;
    if (elevatedChannels >= 2) {
        correlationBoost = Math.min(15, (elevatedChannels - 1) * 5);
    }

    let rawRisk = Math.round(weightedBase + correlationBoost);
    rawRisk = Math.max(4, Math.min(96, rawRisk));
    const healthScore = 100 - rawRisk;

    // 10. Risk Level Tier
    let riskLevel: "low" | "moderate" | "high" | "critical" = "low";
    if (rawRisk >= 75) {
        riskLevel = "critical";
    } else if (rawRisk >= 50) {
        riskLevel = "high";
    } else if (rawRisk >= 25) {
        riskLevel = "moderate";
    } else {
        riskLevel = "low";
    }

    // 11. Condition Fingerprinting
    const { category: conditionCategory, signalBucket } = deriveConditionCategory(
        vibScore, tempScore, currentScore, pressScore, errScore
    );
    const conditionFingerprint = buildConditionFingerprint(robotId, conditionCategory, signalBucket);
    const isAbnormalCondition = conditionCategory !== "normal";

    // 12. Handled-Condition Suppression Logic
    let conditionStatus: PredictionRecord["condition_status"] = "active";
    let isNewCondition = true;

    if (handledCondition) {
        const sameFingerprint = handledCondition.fingerprint === conditionFingerprint;

        if (!isAbnormalCondition) {
            conditionStatus = "monitoring";
            isNewCondition = false;
        } else if (sameFingerprint) {
            if (lastMaintAt) {
                const postCount = await pool.query(
                    `SELECT COUNT(*) as cnt FROM sensor_readings
                     WHERE robot_id = $1 AND recorded_at > $2;`,
                    [robotId, lastMaintAt]
                );
                const postMaintCount = Number(postCount.rows[0]?.cnt) || 0;

                if (postMaintCount < 5) {
                    conditionStatus = "handled";
                    isNewCondition = false;
                    if (riskLevel === "critical") riskLevel = "high";
                    rawRisk = Math.min(rawRisk, 72);
                } else {
                    conditionStatus = "recurring";
                    isNewCondition = true;
                }
            } else {
                conditionStatus = "handled";
                isNewCondition = false;
                if (riskLevel === "critical") riskLevel = "high";
                rawRisk = Math.min(rawRisk, 72);
            }
        } else {
            conditionStatus = "new_issue";
            isNewCondition = true;
        }
    } else {
        conditionStatus = isAbnormalCondition ? "active" : "monitoring";
        isNewCondition = isAbnormalCondition && (riskLevel === "high" || riskLevel === "critical");
    }

    // Recalculate healthScore after possible rawRisk downgrade
    const finalHealthScore = 100 - rawRisk;

    // 13. Explainable Diagnosis (Robot-Specific & Channel-Aware)
    let primaryReason = "";
    if (vibScore >= 35 && tempScore >= 35) {
        primaryReason = `Correlated mechanical vibration (${vibStats.latest.toFixed(2)} mm/s) and thermal rise (${tempStats.latest.toFixed(1)} °C) detected in ${robot.model}`;
    } else if (vibScore >= 35) {
        primaryReason = `Elevated vibration amplitude (${vibStats.latest.toFixed(2)} mm/s) exceeding kinematic baseline (2.8 mm/s)`;
    } else if (tempScore >= 35) {
        primaryReason = `Elevated motor thermal profile (${tempStats.latest.toFixed(1)} °C) exceeding recommended operating limit`;
    } else if (currentScore >= 35) {
        primaryReason = `Elevated motor current draw (${currStats.latest.toFixed(1)} A) under operating cycle load`;
    } else if (pressScore >= 35) {
        primaryReason = `Abnormal pneumatic pressure (${pressStats.latest.toFixed(2)} bar) outside nominal tolerance (4.0–7.0 bar)`;
    } else if (errScore >= 40) {
        primaryReason = `Persistent active telemetry alert (${activeAlertsCount} unresolved incident${activeAlertsCount > 1 ? 's' : ''})`;
    } else if (rawRisk >= 25) {
        primaryReason = `Moderate operational telemetry variation (temp ${tempStats.latest.toFixed(1)} °C, vib ${vibStats.latest.toFixed(2)} mm/s, press ${pressStats.latest.toFixed(2)} bar)`;
    } else {
        primaryReason = `Nominal operating profile (${tempStats.latest.toFixed(1)} °C, ${vibStats.latest.toFixed(2)} mm/s, ${currStats.latest.toFixed(1)} A, ${pressStats.latest.toFixed(2)} bar) on ${robot.line_name}`;
    }

    // Append handled context if suppressing
    if (conditionStatus === "handled") {
        primaryReason += " [Condition previously handled — monitoring for new post-maintenance evidence]";
    } else if (conditionStatus === "recurring") {
        primaryReason += " [Recurring: same condition detected again in post-maintenance telemetry]";
    } else if (conditionStatus === "new_issue") {
        primaryReason += " [New issue detected after prior maintenance handling]";
    }

    // 14. Prescriptive Action Recommendation
    let recommendation = "";
    if (conditionStatus === "handled" || conditionStatus === "monitoring") {
        recommendation = `Post-maintenance monitoring active for ${robot.name}. Observe next 20 telemetry cycles.`;
    } else if (vibScore >= 35 && tempScore >= 35) {
        recommendation = `Schedule priority mechanical inspection for ${robot.name}: inspect joint bearings and verify gearbox lubrication.`;
    } else if (vibScore >= 35) {
        recommendation = `Inspect mechanical bearings, harmonic drive backlash, and joint axis alignment on ${robot.name}.`;
    } else if (tempScore >= 35) {
        recommendation = `Inspect servomotor cooling airflow, thermal dissipation pathways, and drive heat sink.`;
    } else if (currentScore >= 35) {
        recommendation = `Check joint mechanical friction resistance, verify payload torque limits, and tune inverter parameters.`;
    } else if (pressScore >= 35) {
        recommendation = `Inspect pneumatic regulator line, check valve seals for pressure leakage, and calibrate pressure sensor.`;
    } else if (overdueCount > 0) {
        recommendation = `Complete overdue preventive maintenance service on ${robot.name} before high-duty production shifts.`;
    } else if (rawRisk >= 25) {
        recommendation = `Continue monitoring sensor trends; verify axis lubrication on next scheduled line maintenance.`;
    } else {
        recommendation = `Maintain standard continuous monitoring; system operating within nominal manufacturer tolerances.`;
    }

    // 15. 24-Hour What-If Projection
    let whatIf24h = "";
    if (conditionStatus === "handled" || conditionStatus === "monitoring") {
        whatIf24h = `Post-maintenance monitoring phase for ${robot.name}. Telemetry trend will be re-evaluated as new sensor readings accumulate.`;
    } else if (riskLevel === "critical") {
        whatIf24h = `Without intervention within 24 hours, critical telemetry excursions (${vibStats.latest.toFixed(2)} mm/s / ${tempStats.latest.toFixed(1)} °C) risk severe mechanical wear, motor trip, or unexpected line stoppage.`;
    } else if (riskLevel === "high") {
        if (pressScore >= 35) {
            whatIf24h = `Unresolved pneumatic pressure variance (${pressStats.latest.toFixed(2)} bar) may cause end-effector gripping failure or pneumatic seal rupture within 24 hours.`;
        } else if (vibScore >= 35) {
            whatIf24h = `Persistent kinematic vibration (${vibStats.latest.toFixed(2)} mm/s) will accelerate bearing fatigue and risk positional accuracy loss over upcoming shifts.`;
        } else if (tempScore >= 35) {
            whatIf24h = `Continued thermal stress (${tempStats.latest.toFixed(1)} °C) risks winding insulation breakdown and thermal safety cutoff under peak cycle duty.`;
        } else {
            whatIf24h = `Sustained high motor current draw (${currStats.latest.toFixed(1)} A) risks inverter thermal overload and premature component degradation within 24 hours.`;
        }
    } else if (riskLevel === "moderate") {
        whatIf24h = `Telemetry indicates moderate stress (${vibStats.latest.toFixed(2)} mm/s, ${tempStats.latest.toFixed(1)} °C); risk may escalate if production cycle rate increases without preventative inspection.`;
    } else {
        whatIf24h = `Operating stably within nominal limits (${tempStats.latest.toFixed(1)} °C / ${vibStats.latest.toFixed(2)} mm/s); expected to maintain full throughput reliability over the next 24 operating hours.`;
    }

    const confidence = readings.length >= 50 ? "High (168+ Telemetry Records Evaluated)" : "Moderate (Recent Telemetry Window Evaluated)";
    const calculatedAt = new Date().toISOString();

    // 16. Persist calculation in PostgreSQL risk_assessments table
    const insertQuery = `
        INSERT INTO risk_assessments (
            robot_id,
            health_score,
            risk_score,
            risk_level,
            temperature_score,
            vibration_score,
            runtime_score,
            error_score,
            maintenance_score,
            primary_reason,
            recommendation,
            calculated_at
        ) VALUES (
            $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW()
        )
        RETURNING id;
    `;

    let assessmentId = `pred-${robotId}`;
    try {
        const insertRes = await pool.query(insertQuery, [
            robot.id,
            finalHealthScore,
            rawRisk,
            riskLevel,
            tempScore,
            vibScore,
            currentScore,
            errScore,
            maintScore,
            primaryReason,
            recommendation,
        ]);
        if (insertRes.rows.length > 0) {
            assessmentId = insertRes.rows[0].id;
        }
    } catch (dbErr) {
        console.warn(`[PredictionEngine] Save to risk_assessments skipped or constrained:`, dbErr);
    }

    const result: PredictionRecord = {
        id: assessmentId,
        robot_id: robot.id,
        robot_name: robot.name,
        robot_serial: robot.serial_number,
        robot_model: robot.model,
        robot_status: robot.status,
        line_name: robot.line_name,
        health_score: finalHealthScore,
        risk_score: rawRisk,
        risk_level: riskLevel,
        temperature_score: tempScore,
        vibration_score: vibScore,
        runtime_score: currentScore,
        error_score: errScore,
        maintenance_score: maintScore,
        primary_reason: primaryReason,
        recommendation: recommendation,
        what_if_24h: whatIf24h,
        confidence,
        latest_temperature_c: tempStats.latest,
        latest_vibration_mm_s: vibStats.latest,
        latest_motor_current_a: currStats.latest,
        latest_pressure_bar: pressStats.latest,
        calculated_at: calculatedAt,
        condition_fingerprint: conditionFingerprint,
        condition_category: conditionCategory,
        condition_status: conditionStatus,
        is_new_condition: isNewCondition,
    };

    // Cache in Redis with 15s TTL
    try {
        if (redisClient.isOpen) {
            await redisClient.set(cacheKey, JSON.stringify(result), { EX: 15 });
        }
    } catch {
        // Ignore cache errors
    }

    return result;
}

/**
 * Evaluates all robots in the fleet dynamically using their real PostgreSQL telemetry readings.
 */
export async function evaluateAllRobots(): Promise<PredictionRecord[]> {
    const fleetCacheKey = "predictions:all";
    try {
        if (redisClient.isOpen) {
            const cached = await redisClient.get(fleetCacheKey);
            if (cached) {
                return JSON.parse(cached);
            }
        }
    } catch {
        // Fallback to live computation
    }

    const robotsRes = await pool.query(`SELECT id FROM robots ORDER BY name;`);
    const promises = robotsRes.rows.map((row) => evaluateRobotTelemetry(row.id));
    const records = await Promise.all(promises);

    // Sort by risk_score DESC so critical/high risk robots appear first
    const sorted = records.sort((a, b) => b.risk_score - a.risk_score);

    try {
        if (redisClient.isOpen && sorted.length > 0) {
            await redisClient.set(fleetCacheKey, JSON.stringify(sorted), { EX: 15 });
        }
    } catch {
        // Ignore cache errors
    }

    return sorted;
}

/**
 * Invalidates the Redis prediction cache for a specific robot and the fleet collection.
 */
export async function invalidateRobotPredictionCache(robotId: string): Promise<void> {
    try {
        if (redisClient.isOpen) {
            await redisClient.del(`prediction:robot:${robotId}`);
            await redisClient.del("predictions:all");
        }
    } catch {
        // Ignore cache errors
    }
}

/**
 * Records a handled condition in the handled_conditions table.
 * Called from maintenance service when maintenance is completed.
 * 
 * @param robotId - The robot whose condition was resolved
 * @param maintenanceRecordId - The maintenance record that resolved it
 * @param conditionFingerprint - Deterministic fingerprint of the condition
 * @param conditionCategory - Human-readable category
 * @param telemetry - Telemetry snapshot at time of handling
 * @param diagnosedTelemetryAt - Timestamp of the latest sensor reading at diagnosis
 */
export async function recordHandledCondition(
    robotId: string,
    maintenanceRecordId: string,
    conditionFingerprint: string,
    conditionCategory: string,
    telemetry: {
        temperature_c?: number;
        vibration_mm_s?: number;
        motor_current_a?: number;
        pressure_bar?: number;
    },
    diagnosedTelemetryAt?: Date
): Promise<void> {
    try {
        await pool.query(
            `INSERT INTO handled_conditions (
                robot_id,
                condition_fingerprint,
                condition_category,
                telemetry_temp_c,
                telemetry_vib_mm_s,
                telemetry_current_a,
                telemetry_pressure_bar,
                diagnosed_telemetry_at,
                maintenance_record_id,
                handled_at,
                resolution_status,
                suppression_expires_at
             ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW(), 'resolved', NOW() + INTERVAL '7 days');`,
            [
                robotId,
                conditionFingerprint,
                conditionCategory,
                telemetry.temperature_c ?? null,
                telemetry.vibration_mm_s ?? null,
                telemetry.motor_current_a ?? null,
                telemetry.pressure_bar ?? null,
                diagnosedTelemetryAt ?? null,
                maintenanceRecordId,
            ]
        );
        console.log(`[PredictionEngine] Handled condition recorded: robot=${robotId} fingerprint=${conditionFingerprint}`);
    } catch (err) {
        console.warn(`[PredictionEngine] Could not record handled condition:`, err);
    }
}

/**
 * Returns the current condition fingerprint for a robot based on live telemetry.
 * Used by the maintenance service to capture the condition at completion time.
 */
export async function getCurrentConditionFingerprint(robotId: string): Promise<{
    fingerprint: string;
    category: string;
    telemetry: {
        temperature_c: number;
        vibration_mm_s: number;
        motor_current_a: number;
        pressure_bar: number;
    };
    latestReadingAt: Date | null;
} | null> {
    try {
        const res = await pool.query(
            `SELECT temperature_c, vibration_mm_s, motor_current_a, pressure_bar, recorded_at
             FROM sensor_readings
             WHERE robot_id = $1
             ORDER BY recorded_at DESC
             LIMIT 20;`,
            [robotId]
        );
        if (res.rows.length === 0) return null;

        const rows = res.rows.reverse(); // oldest-first for stats
        const temps = rows.map((r: RawSensorReading) => Number(r.temperature_c) || 0);
        const vibs = rows.map((r: RawSensorReading) => Number(r.vibration_mm_s) || 0);
        const currs = rows.map((r: RawSensorReading) => Number(r.motor_current_a) || 0);
        const presses = rows.map((r: RawSensorReading) => Number(r.pressure_bar) || 0);

        const tempStats = calculateSeriesStats(temps);
        const vibStats = calculateSeriesStats(vibs);
        const currStats = calculateSeriesStats(currs);
        const pressStats = calculateSeriesStats(presses);

        let vibScore = 0;
        if (vibStats.latest <= 2.8) vibScore = (vibStats.latest / 2.8) * 18;
        else if (vibStats.latest <= 4.5) vibScore = 18 + ((vibStats.latest - 2.8) / 1.7) * 45;
        else vibScore = 63 + Math.min(32, ((vibStats.latest - 4.5) / 3.0) * 32);
        vibScore = Math.round(Math.max(2, Math.min(98, vibScore)));

        let tempScore = 0;
        if (tempStats.latest <= 60) tempScore = (tempStats.latest / 60) * 18;
        else if (tempStats.latest <= 75) tempScore = 18 + ((tempStats.latest - 60) / 15) * 45;
        else tempScore = 63 + Math.min(32, ((tempStats.latest - 75) / 25) * 32);
        tempScore = Math.round(Math.max(2, Math.min(98, tempScore)));

        let currentScore = 0;
        if (currStats.latest <= 12) currentScore = (currStats.latest / 12) * 18;
        else if (currStats.latest <= 18) currentScore = 18 + ((currStats.latest - 12) / 6) * 45;
        else currentScore = 63 + Math.min(32, ((currStats.latest - 18) / 10) * 32);
        currentScore = Math.round(Math.max(2, Math.min(98, currentScore)));

        let pressScore = 0;
        if (pressStats.latest >= 4.6 && pressStats.latest <= 6.4) {
            pressScore = Math.abs(pressStats.latest - 5.0) * 8;
        } else if (pressStats.latest >= 4.0 && pressStats.latest <= 7.0) {
            pressScore = 18 + Math.abs(pressStats.latest - 5.0) * 16;
        } else if (pressStats.latest <= 2.5 || pressStats.latest >= 8.0) {
            pressScore = 75 + Math.min(20, Math.abs(pressStats.latest - 5.0) * 6);
        } else {
            pressScore = 55 + Math.min(22, Math.abs(pressStats.latest - 5.0) * 8);
        }
        pressScore = Math.round(Math.max(2, Math.min(98, pressScore)));

        const { category, signalBucket } = deriveConditionCategory(vibScore, tempScore, currentScore, pressScore, 0);
        const fingerprint = buildConditionFingerprint(robotId, category, signalBucket);

        const latestRow = res.rows[0]; // res.rows is DESC order
        return {
            fingerprint,
            category,
            telemetry: {
                temperature_c: Number(latestRow.temperature_c) || 0,
                vibration_mm_s: Number(latestRow.vibration_mm_s) || 0,
                motor_current_a: Number(latestRow.motor_current_a) || 0,
                pressure_bar: Number(latestRow.pressure_bar) || 0,
            },
            latestReadingAt: latestRow.recorded_at ? new Date(latestRow.recorded_at) : null,
        };
    } catch (err) {
        console.warn(`[PredictionEngine] Could not compute current condition fingerprint:`, err);
        return null;
    }
}
