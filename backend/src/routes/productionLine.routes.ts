import { Router } from "express";
import { getAllProductionLines } from "../controllers/productionLine.controller.js";

const router = Router();

router.get("/", getAllProductionLines);

export default router;