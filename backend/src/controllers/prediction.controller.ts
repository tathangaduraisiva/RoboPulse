import { Request, Response } from "express";
import { getAllPredictions } from "../services/prediction.service.js";

export async function getPredictions(_req: Request, res: Response): Promise<void> {
    try {
        const predictions = await getAllPredictions();
        res.status(200).json({
            success: true,
            count: predictions.length,
            data: predictions,
        });
    } catch (error) {
        console.error("Failed to fetch predictions:", error);
        res.status(500).json({
            success: false,
            message: "Unable to retrieve prediction data",
        });
    }
}
