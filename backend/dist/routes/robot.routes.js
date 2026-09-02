import { Router } from "express";
import { getRobots } from "../controllers/robot.controller.js";
const router = Router();
router.get("/", getRobots);
export default router;
