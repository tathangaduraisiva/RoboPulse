import { Router } from "express";
import { getRobotSensorReadings } from "../controllers/sensor.controller.js";
const router = Router();
router.get("/:id/readings", getRobotSensorReadings);
router.get("/:id/sensor-readings", getRobotSensorReadings);
export default router;
