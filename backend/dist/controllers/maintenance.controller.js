import { getAllMaintenance, createMaintenance, markMaintenanceComplete, } from "../services/maintenance.service.js";
export async function getMaintenance(_req, res) {
    try {
        const records = await getAllMaintenance();
        res.status(200).json({
            success: true,
            count: records.length,
            data: records,
        });
    }
    catch (error) {
        console.error("Failed to fetch maintenance records:", error);
        res.status(500).json({
            success: false,
            message: "Unable to retrieve maintenance records",
        });
    }
}
export async function postCreateMaintenance(req, res) {
    try {
        const { robot_id, component_id, maintenance_type, description, technician, cost, next_due_at, } = req.body;
        if (!robot_id || !maintenance_type || !description) {
            res.status(400).json({
                success: false,
                message: "Missing required maintenance fields (robot_id, maintenance_type, description)",
            });
            return;
        }
        const newRecord = await createMaintenance({
            robot_id,
            component_id,
            maintenance_type,
            description,
            technician,
            cost: cost ? Number(cost) : undefined,
            next_due_at,
        });
        res.status(201).json({
            success: true,
            data: newRecord,
            message: "Maintenance task scheduled successfully",
        });
    }
    catch (error) {
        console.error("Failed to schedule maintenance:", error);
        res.status(500).json({
            success: false,
            message: "Unable to schedule maintenance",
        });
    }
}
export async function patchCompleteMaintenance(req, res) {
    try {
        const { id } = req.params;
        const updated = await markMaintenanceComplete(id);
        if (!updated) {
            res.status(404).json({
                success: false,
                message: "Maintenance record not found",
            });
            return;
        }
        res.status(200).json({
            success: true,
            data: updated,
            message: "Maintenance task marked as complete",
        });
    }
    catch (error) {
        console.error("Failed to mark maintenance complete:", error);
        res.status(500).json({
            success: false,
            message: "Unable to update maintenance record",
        });
    }
}
