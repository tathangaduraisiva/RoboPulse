import { Request, Response } from "express";
import { getAllRobots } from "../services/robot.service.js";

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