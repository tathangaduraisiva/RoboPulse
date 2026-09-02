import { Router } from "express";
import {
    createAlert,
    getAlertById,
    getAlerts,
    patchAlert,
    patchAcknowledgeAlert,
    patchResolveAlert,
} from "../controllers/alert.controller.js";
import { requireAuth } from "../middleware/auth.middleware.js";

const router = Router();

router.use(requireAuth);
router.get("/", getAlerts);
router.get("/:id", getAlertById);
router.post("/", createAlert);
router.patch("/:id", patchAlert);
router.patch("/:id/acknowledge", patchAcknowledgeAlert);
router.post("/:id/acknowledge", patchAcknowledgeAlert);
router.patch("/:id/resolve", patchResolveAlert);
router.post("/:id/resolve", patchResolveAlert);

export default router;
