import { getAllPredictions, getPredictionByRobotId, getWhatIfByRobotId, } from "../services/prediction.service.js";
export async function getPredictions(_req, res) {
    try {
        const predictions = await getAllPredictions();
        res.status(200).json({
            success: true,
            count: predictions.length,
            data: predictions,
        });
    }
    catch (error) {
        console.error("Failed to fetch predictions:", error);
        res.status(500).json({
            success: false,
            message: "Unable to retrieve prediction data",
        });
    }
}
export async function getPredictionForRobot(req, res) {
    try {
        const robotId = String(req.params.robotId);
        const prediction = await getPredictionByRobotId(robotId);
        res.status(200).json({
            success: true,
            data: prediction,
        });
    }
    catch (error) {
        console.error(`Failed to fetch prediction for robot:`, error);
        res.status(404).json({
            success: false,
            message: error instanceof Error ? error.message : "Prediction not found for robot",
        });
    }
}
export async function getWhatIfForRobot(req, res) {
    try {
        const robotId = String(req.params.robotId);
        const whatIf = await getWhatIfByRobotId(robotId);
        res.status(200).json({
            success: true,
            data: whatIf,
        });
    }
    catch (error) {
        console.error(`Failed to fetch what-if analysis for robot:`, error);
        res.status(404).json({
            success: false,
            message: error instanceof Error ? error.message : "What-If analysis not found for robot",
        });
    }
}
