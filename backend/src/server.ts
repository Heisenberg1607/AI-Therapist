import dotenv from "dotenv";
dotenv.config();
import express, { Request, Response, NextFunction } from "express";
import cors from "cors";
import router from "./Routes/Routes";
import path from "path";
import { createServer } from "http";
import {attachSocket} from "./Socket/index"

const app = express();
const PORT = process.env.PORT || 5001;



const FRONTEND_URL = process.env.FRONTEND_URL || "http://localhost:3000";

const corsOptions: cors.CorsOptions = {
  origin: (origin, callback) => {
    const allowed = [
      "http://localhost:3000",
      "http://localhost:3001",
      FRONTEND_URL,
    ].filter(Boolean);
    if (!origin || allowed.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error("Not allowed by CORS"));
    }
  },
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  credentials: true,
};

// Existing middleware
app.use(cors(corsOptions));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Existing HTTP routes (KEEP THESE!)
app.use("/api", router);
app.use("/audio", express.static(path.join(__dirname, "../audio")));

// Create HTTP server from Express app
const httpServer = createServer(app);

attachSocket(httpServer);



// Start server (use httpServer instead of app)
httpServer.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
