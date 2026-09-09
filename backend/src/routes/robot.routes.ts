import { Router } from "express";
import { getRobots, getRobot } from "../controllers/robot.controller.js";

const router = Router();

router.get("/", getRobots);
router.get("/:id", getRobot);

export default router;