import { Router } from "express";
import { login, register, changePassword } from "../controllers/auth.controller.js";
import { googleInitiate, googleCallback, googleStatus } from "../controllers/google.controller.js";
import { requireAuth } from "../middleware/auth.middleware.js";

const router = Router();

// Username / password
router.post("/login", login);
router.post("/register", register);
router.post("/change-password", requireAuth, changePassword);

// Google OAuth
router.get("/google/status", googleStatus);
router.get("/google", googleInitiate);
router.get("/google/callback", googleCallback);

export default router;
