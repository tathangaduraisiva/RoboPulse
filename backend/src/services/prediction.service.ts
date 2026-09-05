import {
    PredictionRecord,
    evaluateAllRobots,
    evaluateRobotTelemetry,
    invalidateRobotPredictionCache,
} from "./predictionEngine.js";


/**
 * Retrieves dynamic, data-driven predictions for all robots across the fleet.
 */
export async function getAllPredictions(): Promise<PredictionRecord[]> {
    return evaluateAllRobots();
}

/**
 * Retrieves dynamic prediction for a single specific robot.
 */
export async function getPredictionByRobotId(robotId: string): Promise<PredictionRecord> {
    return evaluateRobotTelemetry(robotId);
}

/**
 * Retrieves the 24-hour What-If trajectory for a specific robot.
 */
export async function getWhatIfByRobotId(robotId: string) {
    const prediction = await evaluateRobotTelemetry(robotId);
    return {
        robot_id: prediction.robot_id,
        robot_name: prediction.robot_name,
        current_risk_score: prediction.risk_score,
        current_risk_level: prediction.risk_level,
        primary_reason: prediction.primary_reason,
        what_if_24h: prediction.what_if_24h,
        recommendation: prediction.recommendation,
        confidence: prediction.confidence,
        calculated_at: prediction.calculated_at,
    };
}

export {
    PredictionRecord,
    evaluateAllRobots,
    evaluateRobotTelemetry,
    invalidateRobotPredictionCache,
};
