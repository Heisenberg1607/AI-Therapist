"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const Controller_1 = require("../Controller/Controller");
const Controller_2 = require("../Controller/Controller");
const Controller_3 = require("../Controller/Controller");
const Controller_4 = require("../Controller/Controller");
const authMiddleware_1 = require("../middleware/authMiddleware");
const router = express_1.default.Router();
// Public routes
router.post("/login", Controller_4.login);
router.post("/register", Controller_4.register);
// Health check route
router.get("/health", (_req, res) => {
    res.status(200).json({ status: "ok" });
});
// Protected routes (require authentication)
router.post("/startSession", authMiddleware_1.authenticate, async (req, res, next) => {
    try {
        console.log("🎯 Starting new session");
        await (0, Controller_3.startSession)(req, res);
    }
    catch (error) {
        next(error);
    }
});
// Chat response route (protected)
router.post("/getResponse", authMiddleware_1.authenticate, async (req, res, next) => {
    try {
        console.log("📨 Incoming request:", req.body);
        await (0, Controller_1.generateResponse)(req, res);
    }
    catch (error) {
        next(error);
    }
});
// Welcome Message route (protected)
router.get("/welcomeMessage", authMiddleware_1.authenticate, Controller_2.getWelcomeMessage);
exports.default = router;
