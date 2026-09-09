import { Request, Response } from "express";
import { getAllRobots, getRobotById } from "../services/robot.service.js";

export async function getRobots(
    _req: Request,
    res: Response
): Promise<void> {
    try {
        const robots = await getAllRobots();
        res.status(200).json({
            success: true,
            count: robots.length,
            data: robots,
        });
    } catch (error) {
        console.error("Failed to fetch robots:", error);
        res.status(500).json({
            success: false,
            message: "Unable to retrieve robot data",
        });
    }
}

export async function getRobot(req: Request, res: Response): Promise<void> {
    try {
        const robotId = String(req.params.id ?? "");
        if (!robotId) {
            res.status(400).json({ success: false, message: "Robot ID is required" });
            return;
        }
        const robot = await getRobotById(robotId);
        if (!robot) {
            res.status(404).json({ success: false, message: "Robot not found" });
            return;
        }
        res.status(200).json({ success: true, data: robot });
    } catch (error) {
        console.error("Failed to fetch robot:", error);
        res.status(500).json({ success: false, message: "Unable to retrieve robot data" });
    }
}