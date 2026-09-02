import { Router } from "express";
import {
    getMaintenance,
    postCreateMaintenance,
    patchCompleteMaintenance,
} from "../controllers/maintenance.controller.js";

const router = Router();

router.get("/", getMaintenance);
router.post("/", postCreateMaintenance);
router.patch("/:id/complete", patchCompleteMaintenance);
router.post("/:id/complete", patchCompleteMaintenance);

export default router;
