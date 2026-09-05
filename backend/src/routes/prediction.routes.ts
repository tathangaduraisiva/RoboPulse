import { Router } from "express";
import {
    getPredictions,
    getPredictionForRobot,
    getWhatIfForRobot,
} from "../controllers/prediction.controller.js";

const router = Router();

router.get("/", getPredictions);
router.get("/:robotId", getPredictionForRobot);
router.get("/:robotId/what-if", getWhatIfForRobot);

export default router;
