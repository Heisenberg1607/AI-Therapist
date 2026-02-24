"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.authenticate = void 0;
const jwtUtils_1 = require("../utils/jwtUtils");
const authenticate = (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
        res.status(401).json({ message: "No token provided" });
        return;
    }
    const token = authHeader.split(" ")[1];
    const decoded = (0, jwtUtils_1.verifyToken)(token);
    if (!decoded) {
        res.status(401).json({ message: "Invalid or expired token" });
        return;
    }
    req.userId = decoded.userId;
    next();
};
exports.authenticate = authenticate;
