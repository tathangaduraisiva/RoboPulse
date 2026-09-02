import { getSensorReadingsByRobot } from "../services/sensor.service.js";
export async function getRobotSensorReadings(req, res) {
    try {
        const robotId = String(req.params.id ?? "");
        if (!robotId) {
            res.status(400).json({
                success: false,
                message: "Robot ID is required",
            });
            return;
        }
        const readings = await getSensorReadingsByRobot(robotId);
        res.status(200).json({
            success: true,
            robotId,
            count: readings.length,
            data: readings,
        });
    }
    catch (error) {
        console.error("Failed to fetch sensor readings:", error);
        res.status(500).json({
            success: false,
            message: "Unable to retrieve sensor readings",
        });
    }
}
