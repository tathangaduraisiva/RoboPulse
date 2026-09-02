import { getProductionLines } from "../services/productionLine.service.js";
export async function getAllProductionLines(_req, res) {
    try {
        const lines = await getProductionLines();
        res.status(200).json({
            success: true,
            count: lines.length,
            data: lines,
        });
    }
    catch (error) {
        console.error("Failed to fetch production lines:", error);
        res.status(500).json({
            success: false,
            message: "Unable to retrieve production lines",
        });
    }
}
