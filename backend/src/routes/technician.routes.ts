import { Router } from "express";
import {
    assignTechnicianRobot,
    createTechnicianHandler,
    deleteTechnicianHandler,
    getTechnician,
    getTechnicianAssignmentsHandler,
    getTechnicians,
    removeTechnicianRobot,
    updateTechnicianHandler,
} from "../controllers/technician.controller.js";
import { requireAuth } from "../middleware/auth.middleware.js";

const router = Router();

router.use(requireAuth);
router.get("/", getTechnicians);
router.get("/:id", getTechnician);
router.post("/", createTechnicianHandler);
router.put("/:id", updateTechnicianHandler);
router.delete("/:id", deleteTechnicianHandler);
router.get("/:id/assignments", getTechnicianAssignmentsHandler);
router.post("/:id/assignments/:robotId", assignTechnicianRobot);
router.delete("/:id/assignments/:robotId", removeTechnicianRobot);

export default router;
