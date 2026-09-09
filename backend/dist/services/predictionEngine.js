import { pool } from "../db/postgres.js";
import { redisClient } from "../config/redis.js";
/**
 * Determines the primary anomaly category from component scores.
 * Returns a deterministic category string and a bucket string used in fingerprinting.
 */
function deriveConditionCategory(vibScore, tempScore, currentScore, errScore) {
    if (vibScore >= 50 && tempScore >= 50) {
        return { category: "multi_sensor_anomaly", signalBucket: "vib_temp" };
    }
    if (vibScore >= 50) {
        // Bucket vibration into 3 severity bands so small noise does not change the fingerprint
        const band = vibScore >= 80 ? "severe" : vibScore >= 65 ? "high" : "elevated";
        return { category: "high_vibration", signalBucket: `vib_${band}` };
    }
    if (tempScore >= 50) {
        const band = tempScore >= 80 ? "severe" : tempScore >= 65 ? "high" : "elevated";
        return { category: "thermal_stress", signalBucket: `temp_${band}` };
    }
    if (currentScore >= 50) {
        const band = currentScore >= 80 ? "severe" : currentScore >= 65 ? "high" : "elevated";
        return { category: "abnormal_motor_current", signalBucket: `curr_${band}` };
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
function buildConditionFingerprint(robotId, category, signalBucket) {
    return `${robotId}:${category}:${signalBucket}`;
}
/**
 * Calculates real statistical features and linear trend slope from chronological readings.
 */
function calculateSeriesStats(values) {
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
async function getActiveHandledCondition(robotId) {
    try {
        const res = await pool.query(`SELECT condition_fingerprint, condition_category, handled_at, suppression_expires_at
             FROM handled_conditions
             WHERE robot_id = $1
               AND suppression_expires_at > NOW()
             ORDER BY handled_at DESC
             LIMIT 1;`, [robotId]);
        if (res.rows.length === 0)
            return null;
        const row = res.rows[0];
        return {
            fingerprint: row.condition_fingerprint,
            category: row.condition_category,
            handled_at: new Date(row.handled_at),
            suppression_expires_at: new Date(row.suppression_expires_at),
        };
    }
    catch {
        return null;
    }
}
/**
 * Returns the timestamp of the most recent maintenance completion for a robot,
 * or null if none exists.
 */
async function getLastMaintenanceCompletionTime(robotId) {
    try {
        const res = await pool.query(`SELECT performed_at
             FROM maintenance_records
             WHERE robot_id = $1
               AND condition_handled_at IS NOT NULL
             ORDER BY performed_at DESC
             LIMIT 1;`, [robotId]);
        if (res.rows.length > 0)
            return new Date(res.rows[0].performed_at);
        // Fallback: any recent maintenance completion in last 14 days
        const fallback = await pool.query(`SELECT performed_at
             FROM maintenance_records
             WHERE robot_id = $1
               AND performed_at >= NOW() - INTERVAL '14 days'
             ORDER BY performed_at DESC
             LIMIT 1;`, [robotId]);
        if (fallback.rows.length > 0)
            return new Date(fallback.rows[0].performed_at);
        return null;
    }
    catch {
        return null;
    }
}
/**
 * Evaluates a single robot's predictive risk dynamically from real PostgreSQL telemetry.
 */
export async function evaluateRobotTelemetry(robotId) {
    const cacheKey = `prediction:robot:${robotId}`;
    try {
        if (redisClient.isOpen) {
            const cached = await redisClient.get(cacheKey);
            if (cached) {
                return JSON.parse(cached);
            }
        }
    }
    catch {
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
    let readingsQuery;
    let readingsParams;
    if (lastMaintAt) {
        // Use post-maintenance readings first (need at least 5); fall back to all if scarce.
        const postMaintCheck = await pool.query(`SELECT COUNT(*) as cnt FROM sensor_readings
             WHERE robot_id = $1 AND recorded_at > $2;`, [robotId, lastMaintAt]);
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
        }
        else {
            // Scarce post-maintenance readings — use all but note context
            readingsQuery = `
                SELECT temperature_c, vibration_mm_s, motor_current_a, pressure_bar, recorded_at
                FROM sensor_readings
                WHERE robot_id = $1
                ORDER BY recorded_at ASC;
            `;
            readingsParams = [robotId];
        }
    }
    else {
        readingsQuery = `
            SELECT temperature_c, vibration_mm_s, motor_current_a, pressure_bar, recorded_at
            FROM sensor_readings
            WHERE robot_id = $1
            ORDER BY recorded_at ASC;
        `;
        readingsParams = [robotId];
    }
    const readingsRes = await pool.query(readingsQuery, readingsParams);
    const readings = readingsRes.rows.map((r) => ({
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
        const fallbackRecord = {
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
    }
    else if (vibStats.latest <= 4.5) {
        vibScore = 18 + ((vibStats.latest - 2.8) / 1.7) * 45;
    }
    else {
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
    }
    else if (tempStats.latest <= 75) {
        tempScore = 18 + ((tempStats.latest - 60) / 15) * 45;
    }
    else {
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
    }
    else if (currStats.latest <= 18) {
        currentScore = 18 + ((currStats.latest - 12) / 6) * 45;
    }
    else {
        currentScore = 63 + Math.min(32, ((currStats.latest - 18) / 10) * 32);
    }
    const runtimeAging = Math.min(12, (runtimeHours / 10000) * 12);
    currentScore += runtimeAging;
    currentScore = Math.max(2, Math.min(98, Math.round(currentScore)));
    // D. Error / Alert Score
    let errScore = Math.min(95, activeAlertsCount * 18 + criticalAlertsCount * 25);
    if (errScore === 0)
        errScore = 4;
    // E. Maintenance Urgency Score
    let maintScore = 10;
    if (overdueCount > 0) {
        maintScore = 65;
    }
    else if (recentCompletedCount > 0) {
        maintScore = 5;
    }
    else if (runtimeHours > 6000) {
        maintScore = 25;
    }
    // 9. Multi-Sensor Correlation & Composite Risk Calculation
    const weightedBase = 0.35 * vibScore +
        0.30 * tempScore +
        0.20 * currentScore +
        0.10 * errScore +
        0.05 * maintScore;
    let elevatedChannels = 0;
    if (vibScore >= 35)
        elevatedChannels++;
    if (tempScore >= 35)
        elevatedChannels++;
    if (currentScore >= 35)
        elevatedChannels++;
    if (errScore >= 35)
        elevatedChannels++;
    let correlationBoost = 0;
    if (elevatedChannels >= 2) {
        correlationBoost = Math.min(15, (elevatedChannels - 1) * 6);
    }
    let rawRisk = Math.round(weightedBase + correlationBoost);
    rawRisk = Math.max(4, Math.min(96, rawRisk));
    const healthScore = 100 - rawRisk;
    // 10. Risk Level Tier
    let riskLevel = "low";
    if (rawRisk >= 75) {
        riskLevel = "critical";
    }
    else if (rawRisk >= 50) {
        riskLevel = "high";
    }
    else if (rawRisk >= 25) {
        riskLevel = "moderate";
    }
    else {
        riskLevel = "low";
    }
    // 11. Condition Fingerprinting
    const { category: conditionCategory, signalBucket } = deriveConditionCategory(vibScore, tempScore, currentScore, errScore);
    const conditionFingerprint = buildConditionFingerprint(robotId, conditionCategory, signalBucket);
    const isAbnormalCondition = conditionCategory !== "normal";
    // 12. Handled-Condition Suppression Logic
    //
    //  If there is an active (non-expired) handled condition for this robot:
    //   - Same fingerprint: suppress — return "handled" / "monitoring" based on risk
    //   - Different fingerprint but still abnormal: allow — this is a new_issue
    //   - Normal readings: mark as monitoring regardless
    //
    let conditionStatus = "active";
    let isNewCondition = true;
    if (handledCondition) {
        const sameFingerprint = handledCondition.fingerprint === conditionFingerprint;
        if (!isAbnormalCondition) {
            // Telemetry is back to normal — post-maintenance monitoring
            conditionStatus = "monitoring";
            isNewCondition = false;
        }
        else if (sameFingerprint) {
            // Same condition fingerprint as the previously handled one.
            // Determine whether the risk has genuinely worsened vs. stale historical data.
            if (lastMaintAt) {
                // Check how many post-maintenance readings contributed to this score
                const postCount = await pool.query(`SELECT COUNT(*) as cnt FROM sensor_readings
                     WHERE robot_id = $1 AND recorded_at > $2;`, [robotId, lastMaintAt]);
                const postMaintCount = Number(postCount.rows[0]?.cnt) || 0;
                if (postMaintCount < 5) {
                    // Insufficient post-maintenance evidence — this is likely the old condition
                    // re-surfacing from historical telemetry. Suppress it.
                    conditionStatus = "handled";
                    isNewCondition = false;
                    // Downgrade risk tier to avoid "false critical" — real risk from
                    // post-maintenance data will be reevaluated as readings accumulate
                    if (riskLevel === "critical")
                        riskLevel = "high";
                    rawRisk = Math.min(rawRisk, 72); // Stay below critical threshold
                }
                else {
                    // Enough post-maintenance data supports the same condition —
                    // this is a genuine recurrence
                    conditionStatus = "recurring";
                    isNewCondition = true;
                }
            }
            else {
                // No tracked maintenance completion, but a handled condition exists —
                // treat as handled to be safe
                conditionStatus = "handled";
                isNewCondition = false;
                if (riskLevel === "critical")
                    riskLevel = "high";
                rawRisk = Math.min(rawRisk, 72);
            }
        }
        else {
            // Different fingerprint AND abnormal — genuinely new issue
            conditionStatus = "new_issue";
            isNewCondition = true;
        }
    }
    else {
        // No active suppression — treat normally
        conditionStatus = isAbnormalCondition ? "active" : "monitoring";
        isNewCondition = isAbnormalCondition && (riskLevel === "high" || riskLevel === "critical");
    }
    // Recalculate healthScore after possible rawRisk downgrade
    const finalHealthScore = 100 - rawRisk;
    // 13. Explainable Diagnosis
    let primaryReason = "";
    if (vibScore >= 50 && tempScore >= 50) {
        primaryReason = `Correlated vibration (${vibStats.latest.toFixed(2)} mm/s) and thermal (${tempStats.latest.toFixed(1)} °C) elevation`;
    }
    else if (vibScore >= 50) {
        primaryReason = `Elevated vibration amplitude (${vibStats.latest.toFixed(2)} mm/s) exceeding kinematic baseline`;
    }
    else if (tempScore >= 50) {
        primaryReason = `Elevated thermal profile (${tempStats.latest.toFixed(1)} °C) detected in drive servomotor`;
    }
    else if (currentScore >= 50) {
        primaryReason = `Elevated motor current draw (${currStats.latest.toFixed(1)} A) under extended operating load`;
    }
    else if (errScore >= 40) {
        primaryReason = `Persistent unresolved telemetry alerts requiring diagnostic clearance`;
    }
    else if (rawRisk >= 25) {
        primaryReason = `Moderate telemetry variance (${vibStats.latest.toFixed(2)} mm/s, ${tempStats.latest.toFixed(1)} °C) within acceptable bounds`;
    }
    else {
        primaryReason = `Stable operating profile across all telemetry channels`;
    }
    // Append handled context if suppressing
    if (conditionStatus === "handled") {
        primaryReason += " [Condition previously handled — monitoring for new post-maintenance evidence]";
    }
    else if (conditionStatus === "recurring") {
        primaryReason += " [Recurring: same condition detected again in post-maintenance telemetry]";
    }
    else if (conditionStatus === "new_issue") {
        primaryReason += " [New issue detected after prior maintenance handling]";
    }
    // 14. Prescriptive Action Recommendation
    let recommendation = "";
    if (conditionStatus === "handled" || conditionStatus === "monitoring") {
        recommendation = "Post-maintenance monitoring active. Continue observing telemetry trends.";
    }
    else if (vibScore >= 50 && tempScore >= 50) {
        recommendation = "Schedule immediate multi-point mechanical inspection and verify gearbox lubrication.";
    }
    else if (vibScore >= 50) {
        recommendation = "Inspect mechanical bearings, couplings, and joint alignment within 7 operating days.";
    }
    else if (tempScore >= 50) {
        recommendation = "Inspect cooling airflow, thermal dissipation pathways, and motor drive housing.";
    }
    else if (currentScore >= 50) {
        recommendation = "Check joint friction resistance, payload balance, and inverter drive parameters.";
    }
    else if (overdueCount > 0) {
        recommendation = "Complete overdue preventative maintenance service before high-duty production cycles.";
    }
    else if (rawRisk >= 25) {
        recommendation = "Continue monitoring telemetry trends; verify lubrication on next scheduled cycle.";
    }
    else {
        recommendation = "Continue routine continuous monitoring; system operating within nominal tolerances.";
    }
    // 15. 24-Hour What-If Projection
    let whatIf24h = "";
    if (conditionStatus === "handled" || conditionStatus === "monitoring") {
        whatIf24h = `Post-maintenance monitoring phase. Telemetry will be re-evaluated as new readings accumulate.`;
    }
    else if (riskLevel === "critical") {
        whatIf24h = `Without intervention, sustained vibration (${vibStats.latest.toFixed(2)} mm/s) and thermal stress could accelerate bearing wear and cause unscheduled downtime.`;
    }
    else if (riskLevel === "high") {
        whatIf24h = `Potential continued degradation if current elevated vibration and temperature trends persist over upcoming operating shifts.`;
    }
    else if (riskLevel === "moderate") {
        whatIf24h = `Telemetry indicates moderate stress; risk may escalate if operational duty cycle increases without scheduled inspection.`;
    }
    else {
        whatIf24h = `Operating well within nominal tolerances; expected to maintain stable performance over the next 24 operating hours.`;
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
    }
    catch (dbErr) {
        console.warn(`[PredictionEngine] Save to risk_assessments skipped or constrained:`, dbErr);
    }
    const result = {
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
    }
    catch {
        // Ignore cache errors
    }
    return result;
}
/**
 * Evaluates all robots in the fleet dynamically using their real PostgreSQL telemetry readings.
 */
export async function evaluateAllRobots() {
    const fleetCacheKey = "predictions:all";
    try {
        if (redisClient.isOpen) {
            const cached = await redisClient.get(fleetCacheKey);
            if (cached) {
                return JSON.parse(cached);
            }
        }
    }
    catch {
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
    }
    catch {
        // Ignore cache errors
    }
    return sorted;
}
/**
 * Invalidates the Redis prediction cache for a specific robot and the fleet collection.
 */
export async function invalidateRobotPredictionCache(robotId) {
    try {
        if (redisClient.isOpen) {
            await redisClient.del(`prediction:robot:${robotId}`);
            await redisClient.del("predictions:all");
        }
    }
    catch {
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
export async function recordHandledCondition(robotId, maintenanceRecordId, conditionFingerprint, conditionCategory, telemetry, diagnosedTelemetryAt) {
    try {
        await pool.query(`INSERT INTO handled_conditions (
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
             ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW(), 'resolved', NOW() + INTERVAL '7 days');`, [
            robotId,
            conditionFingerprint,
            conditionCategory,
            telemetry.temperature_c ?? null,
            telemetry.vibration_mm_s ?? null,
            telemetry.motor_current_a ?? null,
            telemetry.pressure_bar ?? null,
            diagnosedTelemetryAt ?? null,
            maintenanceRecordId,
        ]);
        console.log(`[PredictionEngine] Handled condition recorded: robot=${robotId} fingerprint=${conditionFingerprint}`);
    }
    catch (err) {
        console.warn(`[PredictionEngine] Could not record handled condition:`, err);
    }
}
/**
 * Returns the current condition fingerprint for a robot based on live telemetry.
 * Used by the maintenance service to capture the condition at completion time.
 */
export async function getCurrentConditionFingerprint(robotId) {
    try {
        const res = await pool.query(`SELECT temperature_c, vibration_mm_s, motor_current_a, pressure_bar, recorded_at
             FROM sensor_readings
             WHERE robot_id = $1
             ORDER BY recorded_at DESC
             LIMIT 20;`, [robotId]);
        if (res.rows.length === 0)
            return null;
        const rows = res.rows.reverse(); // oldest-first for stats
        const temps = rows.map((r) => Number(r.temperature_c) || 0);
        const vibs = rows.map((r) => Number(r.vibration_mm_s) || 0);
        const currs = rows.map((r) => Number(r.motor_current_a) || 0);
        const tempStats = calculateSeriesStats(temps);
        const vibStats = calculateSeriesStats(vibs);
        const currStats = calculateSeriesStats(currs);
        let vibScore = 0;
        if (vibStats.latest <= 2.8)
            vibScore = (vibStats.latest / 2.8) * 18;
        else if (vibStats.latest <= 4.5)
            vibScore = 18 + ((vibStats.latest - 2.8) / 1.7) * 45;
        else
            vibScore = 63 + Math.min(32, ((vibStats.latest - 4.5) / 3.0) * 32);
        vibScore = Math.round(Math.max(2, Math.min(98, vibScore)));
        let tempScore = 0;
        if (tempStats.latest <= 60)
            tempScore = (tempStats.latest / 60) * 18;
        else if (tempStats.latest <= 75)
            tempScore = 18 + ((tempStats.latest - 60) / 15) * 45;
        else
            tempScore = 63 + Math.min(32, ((tempStats.latest - 75) / 25) * 32);
        tempScore = Math.round(Math.max(2, Math.min(98, tempScore)));
        let currentScore = 0;
        if (currStats.latest <= 12)
            currentScore = (currStats.latest / 12) * 18;
        else if (currStats.latest <= 18)
            currentScore = 18 + ((currStats.latest - 12) / 6) * 45;
        else
            currentScore = 63 + Math.min(32, ((currStats.latest - 18) / 10) * 32);
        currentScore = Math.round(Math.max(2, Math.min(98, currentScore)));
        const { category, signalBucket } = deriveConditionCategory(vibScore, tempScore, currentScore, 0);
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
    }
    catch (err) {
        console.warn(`[PredictionEngine] Could not compute current condition fingerprint:`, err);
        return null;
    }
}
