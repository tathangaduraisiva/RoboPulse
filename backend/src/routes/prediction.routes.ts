import { Router } from "express";
import { getPredictions } from "../controllers/prediction.controller.js";

const router = Router();

router.get("/", getPredictions);

export default router;
