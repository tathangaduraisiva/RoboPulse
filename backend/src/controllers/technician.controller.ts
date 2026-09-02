import type { Request, Response } from "express";
import {
    assignRobotToTechnician,
    createTechnician,
    deleteTechnician,
    getAllTechnicians,
    getTechnicianById,
    getTechnicianAssignments,
    removeRobotAssignment,
    updateTechnician,
} from "../services/technician.service.js";

export async function getTechnicians(_req: Request, res: Response): Promise<void> {
    try {
        const technicians = await getAllTechnicians();
        res.status(200).json({
            success: true,
            count: technicians.length,
            data: technicians,
        });
    } catch (error) {
        console.error("Failed to fetch technicians:", error);
        res.status(500).json({
            success: false,
            message: "Unable to retrieve technicians",
        });
    }
}

export async function getTechnician(req: Request, res: Response): Promise<void> {
    try {
        const id = typeof req.params.id === 'string' ? req.params.id : '';
        const technician = await getTechnicianById(id);

        if (!technician) {
            res.status(404).json({ success: false, message: "Technician not found" });
            return;
        }

        res.status(200).json({ success: true, data: technician });
    } catch (error) {
        console.error("Failed to fetch technician:", error);
        res.status(500).json({ success: false, message: "Unable to retrieve technician" });
    }
}

export async function createTechnicianHandler(req: Request, res: Response): Promise<void> {
    try {
        const { name, employee_code, specialization, email, phone, status } = req.body ?? {};

        if (!name || typeof name !== "string" || !name.trim()) {
            res.status(400).json({ success: false, message: "Full name is required" });
            return;
        }

        // Auto-generate employee code if omitted
        const effectiveCode = (employee_code && typeof employee_code === "string" && employee_code.trim())
            ? employee_code.trim()
            : `TECH-${Math.floor(100 + Math.random() * 900)}`;

        const effectiveSpecialization = (specialization && typeof specialization === "string" && specialization.trim())
            ? specialization.trim().toLowerCase()
            : "general";

        if (email && typeof email === "string" && email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
            res.status(400).json({ success: false, message: "Please provide a valid email address" });
            return;
        }

        const validStatus = status === "assigned" || status === "offline" ? status : "available";

        const technician = await createTechnician({
            name: name.trim(),
            employee_code: effectiveCode,
            specialization: effectiveSpecialization,
            email: email?.trim() || null,
            phone: phone?.trim() || null,
            status: validStatus,
        });

        res.status(201).json({ success: true, data: technician, message: "Technician created successfully" });
    } catch (error: unknown) {
        console.error("Failed to create technician:", error);
        const message = error instanceof Error && /duplicate|unique/i.test(error.message) ? "Employee code or email already exists" : "Unable to create technician";
        res.status(400).json({ success: false, message });
    }
}

export async function updateTechnicianHandler(req: Request, res: Response): Promise<void> {
    try {
        const id = typeof req.params.id === 'string' ? req.params.id : '';
        const payload = req.body ?? {};
        const technician = await updateTechnician(id, payload);

        if (!technician) {
            res.status(404).json({ success: false, message: "Technician not found" });
            return;
        }

        res.status(200).json({ success: true, data: technician, message: "Technician updated successfully" });
    } catch (error) {
        console.error("Failed to update technician:", error);
        res.status(500).json({ success: false, message: "Unable to update technician" });
    }
}

export async function deleteTechnicianHandler(req: Request, res: Response): Promise<void> {
    try {
        const id = typeof req.params.id === 'string' ? req.params.id : '';
        const deleted = await deleteTechnician(id);

        if (!deleted) {
            res.status(404).json({ success: false, message: "Technician not found" });
            return;
        }

        res.status(200).json({ success: true, message: "Technician deleted successfully" });
    } catch (error) {
        console.error("Failed to delete technician:", error);
        res.status(500).json({ success: false, message: "Unable to delete technician" });
    }
}

export async function assignTechnicianRobot(req: Request, res: Response): Promise<void> {
    try {
        const id = typeof req.params.id === 'string' ? req.params.id : '';
        const robotId = typeof req.params.robotId === 'string' ? req.params.robotId : '';
        const result = await assignRobotToTechnician(id, robotId);
        res.status(200).json({ success: true, data: result, message: "Robot assigned successfully" });
    } catch (error) {
        console.error("Failed to assign robot:", error);
        res.status(400).json({ success: false, message: "Unable to assign robot to technician" });
    }
}

export async function removeTechnicianRobot(req: Request, res: Response): Promise<void> {
    try {
        const id = typeof req.params.id === 'string' ? req.params.id : '';
        const robotId = typeof req.params.robotId === 'string' ? req.params.robotId : '';
        const removed = await removeRobotAssignment(id, robotId);

        if (!removed) {
            res.status(404).json({ success: false, message: "Assignment not found" });
            return;
        }

        res.status(200).json({ success: true, message: "Assignment removed successfully" });
    } catch (error) {
        console.error("Failed to remove assignment:", error);
        res.status(500).json({ success: false, message: "Unable to remove assignment" });
    }
}

export async function getTechnicianAssignmentsHandler(req: Request, res: Response): Promise<void> {
    try {
        const id = typeof req.params.id === 'string' ? req.params.id : '';
        const assignments = await getTechnicianAssignments(id);
        res.status(200).json({ success: true, count: assignments.length, data: assignments });
    } catch (error) {
        console.error("Failed to fetch assignments:", error);
        res.status(500).json({ success: false, message: "Unable to retrieve assignments" });
    }
}
