"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const Routes_1 = __importDefault(require("./Routes/Routes"));
const path_1 = __importDefault(require("path"));
const app = (0, express_1.default)();
app.use("/audio", express_1.default.static(path_1.default.join(__dirname, "../audio")));
// Enable CORS for all routes with specific configuration
app.use((0, cors_1.default)({
    origin: true,
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
}));
// Logging middleware
app.use((req, _res, next) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
    next();
});
// Body parsers
app.use(express_1.default.json());
app.use(express_1.default.urlencoded({ extended: true }));
app.use("/api", Routes_1.default);
// Error handling
app.use((err, _req, res, _next) => {
    console.error(err.stack);
    res.status(500).json({ error: "Internal Server Error" });
});
const PORT = 5001;
app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
});
exports.default = app;
