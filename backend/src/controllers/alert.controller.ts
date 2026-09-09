import { Request, Response } from "express";
import {
    getAllAlerts,
    acknowledgeAlert,
    resolveAlert,
    createAlertRecord,
    getAlertById as fetchAlertById,
    updateAlertStatus,
} from "../services/alert.service.js";

export async function getAlerts(_req: Request, res: Response): Promise<void> {
    try {
        const alerts = await getAllAlerts();
        res.status(200).json({
            success: true,
            count: alerts.length,
            data: alerts,
        });
    } catch (error) {
        console.error("Failed to fetch alerts:", error);
        res.status(500).json({
            success: false,
            message: "Unable to retrieve alerts",
        });
    }
}

export async function getAlertById(req: Request, res: Response): Promise<void> {
    try {
        const id = typeof req.params.id === 'string' ? req.params.id : '';
        const alert = await fetchAlertById(id);

        if (!alert) {
            res.status(404).json({ success: false, message: "Alert not found" });
            return;
        }

        res.status(200).json({ success: true, data: alert });
    } catch (error) {
        console.error("Failed to fetch alert:", error);
        res.status(500).json({ success: false, message: "Unable to retrieve alert" });
    }
}

export async function createAlert(req: Request, res: Response): Promise<void> {
    try {
        const { robot_id, type, severity, message, status } = req.body ?? {};

        if (!robot_id || !type || !severity || !message) {
            res.status(400).json({
                success: false,
                message: "robot_id, type, severity, and message are required",
            });
            return;
        }

        const created = await createAlertRecord({
            robot_id,
            type,
            severity,
            message,
            status,
        });

        if (!created) {
            // Alert was suppressed by deduplication (handled condition or duplicate active alert)
            res.status(200).json({
                success: true,
                data: null,
                deduplicated: true,
                message: "Alert suppressed: an equivalent alert already exists or condition is currently handled",
            });
            return;
        }

        res.status(201).json({ success: true, data: created, message: "Alert created successfully" });
    } catch (error) {
        console.error("Failed to create alert:", error);
        res.status(500).json({ success: false, message: "Unable to create alert" });
    }
}

export async function patchAlert(req: Request, res: Response): Promise<void> {
    try {
        const id = typeof req.params.id === 'string' ? req.params.id : '';
        const { status, severity, message } = req.body ?? {};
        const updated = await updateAlertStatus(id, { status, severity, message });

        if (!updated) {
            res.status(404).json({ success: false, message: "Alert not found" });
            return;
        }

        res.status(200).json({ success: true, data: updated, message: "Alert updated successfully" });
    } catch (error) {
        console.error("Failed to update alert:", error);
        res.status(500).json({ success: false, message: "Unable to update alert" });
    }
}

export async function patchAcknowledgeAlert(
    req: Request,
    res: Response
): Promise<void> {
    try {
        const { id } = req.params;
        const updated = await acknowledgeAlert(id as string);
        if (!updated) {
            res.status(404).json({
                success: false,
                message: "Alert not found",
            });
            return;
        }
        res.status(200).json({
            success: true,
            data: updated,
            message: "Alert marked as investigating",
        });
    } catch (error) {
        console.error("Failed to acknowledge alert:", error);
        res.status(500).json({
            success: false,
            message: "Unable to update alert",
        });
    }
}

export async function patchResolveAlert(
    req: Request,
    res: Response
): Promise<void> {
    try {
        const { id } = req.params;
        const updated = await resolveAlert(id as string);
        if (!updated) {
            res.status(404).json({
                success: false,
                message: "Alert not found",
            });
            return;
        }
        res.status(200).json({
            success: true,
            data: updated,
            message: "Alert marked as resolved",
        });
    } catch (error) {
        console.error("Failed to resolve alert:", error);
        res.status(500).json({
            success: false,
            message: "Unable to update alert",
        });
    }
}
