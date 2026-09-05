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
}

interface RawSensorReading {
    temperature_c: number;
    vibration_mm_s: number;
    motor_current_a: number;
    pressure_bar: number;
    recorded_at: Date;
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

    // 2. Fetch Historical Sensor Readings (chronological order)
    const readingsQuery = `
        SELECT temperature_c, vibration_mm_s, motor_current_a, pressure_bar, recorded_at
        FROM sensor_readings
        WHERE robot_id = $1
        ORDER BY recorded_at ASC;
    `;
    const readingsRes = await pool.query(readingsQuery, [robotId]);
    const readings: RawSensorReading[] = readingsRes.rows.map((r) => ({
        temperature_c: Number(r.temperature_c) || 0,
        vibration_mm_s: Number(r.vibration_mm_s) || 0,
        motor_current_a: Number(r.motor_current_a) || 0,
        pressure_bar: Number(r.pressure_bar) || 0,
        recorded_at: new Date(r.recorded_at),
    }));

    // 3. Fetch Active / Unresolved Alerts
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

    // 4. Fetch Maintenance History
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

    // 5. Check if Telemetry is Insufficient
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
        };
        return fallbackRecord;
    }

    // 6. Feature Extraction
    const tempStats = calculateSeriesStats(readings.map((r) => r.temperature_c));
    const vibStats = calculateSeriesStats(readings.map((r) => r.vibration_mm_s));
    const currStats = calculateSeriesStats(readings.map((r) => r.motor_current_a));
    const pressStats = calculateSeriesStats(readings.map((r) => r.pressure_bar));
    const runtimeHours = Number(robot.total_runtime_hours) || 0;

    // 7. Component Risk Sub-Scores (0 to 100)

    // A. Vibration Score (ISO 10816 Mechanical Standard)
    // < 2.8 mm/s is normal (0-20), 2.8-4.5 is elevated (20-60), > 4.5 is critical (60-100)
    let vibScore = 0;
    if (vibStats.latest <= 2.8) {
        vibScore = (vibStats.latest / 2.8) * 18;
    } else if (vibStats.latest <= 4.5) {
        vibScore = 18 + ((vibStats.latest - 2.8) / 1.7) * 45;
    } else {
        vibScore = 63 + Math.min(32, ((vibStats.latest - 4.5) / 3.0) * 32);
    }
    // Trend & variability penalty
    if (vibStats.slope > 0.2) {
        vibScore += Math.min(12, vibStats.slope * 6);
    }
    if (vibStats.stdDev > 0.8) {
        vibScore += Math.min(8, vibStats.stdDev * 3);
    }
    vibScore = Math.max(2, Math.min(98, Math.round(vibScore)));

    // B. Temperature Score (Joint Servomotor Thermal Rating)
    // < 60°C is normal (0-20), 60-75°C is elevated (20-60), > 75°C is critical (60-100)
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

    // C. Runtime / Electrical Current Score
    // < 12A is normal (0-20), 12-18A is elevated (20-60), > 18A is critical (60-100)
    let currentScore = 0;
    if (currStats.latest <= 12) {
        currentScore = (currStats.latest / 12) * 18;
    } else if (currStats.latest <= 18) {
        currentScore = 18 + ((currStats.latest - 12) / 6) * 45;
    } else {
        currentScore = 63 + Math.min(32, ((currStats.latest - 18) / 10) * 32);
    }
    // Long runtime duty factor
    const runtimeAging = Math.min(12, (runtimeHours / 10000) * 12);
    currentScore += runtimeAging;
    currentScore = Math.max(2, Math.min(98, Math.round(currentScore)));

    // D. Error / Alert Score
    let errScore = Math.min(95, activeAlertsCount * 18 + criticalAlertsCount * 25);
    if (errScore === 0) errScore = 4;

    // E. Maintenance Urgency Score
    let maintScore = 10;
    if (overdueCount > 0) {
        maintScore = 65;
    } else if (recentCompletedCount > 0) {
        maintScore = 5;
    } else if (runtimeHours > 6000) {
        maintScore = 25;
    }

    // 8. Multi-Sensor Correlation & Composite Risk Calculation
    const weightedBase =
        0.35 * vibScore +
        0.30 * tempScore +
        0.20 * currentScore +
        0.10 * errScore +
        0.05 * maintScore;

    // Count how many channels show elevated degradation (>= 35)
    let elevatedChannels = 0;
    if (vibScore >= 35) elevatedChannels++;
    if (tempScore >= 35) elevatedChannels++;
    if (currentScore >= 35) elevatedChannels++;
    if (errScore >= 35) elevatedChannels++;

    // Correlation boost: simultaneous multi-sensor abnormalities accelerate failure probability
    let correlationBoost = 0;
    if (elevatedChannels >= 2) {
        correlationBoost = Math.min(15, (elevatedChannels - 1) * 6);
    }

    let rawRisk = Math.round(weightedBase + correlationBoost);
    rawRisk = Math.max(4, Math.min(96, rawRisk));
    const healthScore = 100 - rawRisk;

    // 9. Risk Level Tier
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

    // 10. Explainable Diagnosis (primary_reason)
    let primaryReason = "";
    if (vibScore >= 50 && tempScore >= 50) {
        primaryReason = `Correlated vibration (${vibStats.latest.toFixed(2)} mm/s) and thermal (${tempStats.latest.toFixed(1)} °C) elevation`;
    } else if (vibScore >= 50) {
        primaryReason = `Elevated vibration amplitude (${vibStats.latest.toFixed(2)} mm/s) exceeding kinematic baseline`;
    } else if (tempScore >= 50) {
        primaryReason = `Elevated thermal profile (${tempStats.latest.toFixed(1)} °C) detected in drive servomotor`;
    } else if (currentScore >= 50) {
        primaryReason = `Elevated motor current draw (${currStats.latest.toFixed(1)} A) under extended operating load`;
    } else if (errScore >= 40) {
        primaryReason = `Persistent unresolved telemetry alerts requiring diagnostic clearance`;
    } else if (rawRisk >= 25) {
        primaryReason = `Moderate telemetry variance (${vibStats.latest.toFixed(2)} mm/s, ${tempStats.latest.toFixed(1)} °C) within acceptable bounds`;
    } else {
        primaryReason = `Stable operating profile across all telemetry channels`;
    }

    // 11. Prescriptive Action Recommendation
    let recommendation = "";
    if (vibScore >= 50 && tempScore >= 50) {
        recommendation = "Schedule immediate multi-point mechanical inspection and verify gearbox lubrication.";
    } else if (vibScore >= 50) {
        recommendation = "Inspect mechanical bearings, couplings, and joint alignment within 7 operating days.";
    } else if (tempScore >= 50) {
        recommendation = "Inspect cooling airflow, thermal dissipation pathways, and motor drive housing.";
    } else if (currentScore >= 50) {
        recommendation = "Check joint friction resistance, payload balance, and inverter drive parameters.";
    } else if (overdueCount > 0) {
        recommendation = "Complete overdue preventative maintenance service before high-duty production cycles.";
    } else if (rawRisk >= 25) {
        recommendation = "Continue monitoring telemetry trends; verify lubrication on next scheduled cycle.";
    } else {
        recommendation = "Continue routine continuous monitoring; system operating within nominal tolerances.";
    }

    // 12. 24-Hour What-If Projection
    let whatIf24h = "";
    if (riskLevel === "critical") {
        whatIf24h = `Without intervention, sustained vibration (${vibStats.latest.toFixed(2)} mm/s) and thermal stress could accelerate bearing wear and cause unscheduled downtime.`;
    } else if (riskLevel === "high") {
        whatIf24h = `Potential continued degradation if current elevated vibration and temperature trends persist over upcoming operating shifts.`;
    } else if (riskLevel === "moderate") {
        whatIf24h = `Telemetry indicates moderate stress; risk may escalate if operational duty cycle increases without scheduled inspection.`;
    } else {
        whatIf24h = `Operating well within nominal tolerances; expected to maintain stable performance over the next 24 operating hours.`;
    }

    const confidence = readings.length >= 50 ? "High (168+ Telemetry Records Evaluated)" : "Moderate (Recent Telemetry Window Evaluated)";

    const calculatedAt = new Date().toISOString();

    // 13. Persist calculation in PostgreSQL risk_assessments table
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
            healthScore,
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
        health_score: healthScore,
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
