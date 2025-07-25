import express, { Request, Response, NextFunction } from "express";
import cors from "cors";
import router from "./Routes/Routes";
import path from "path";

const app = express();

app.use("/audio", express.static(path.join(__dirname, "../audio")));

// Enable CORS for all routes with specific configuration
app.use(
  cors({
    origin: true,
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  })
);

// Logging middleware

app.use((req: Request, _res: Response, next: NextFunction) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);

  next();
});

// Body parsers

app.use(express.json());

app.use(express.urlencoded({ extended: true }));



app.use("/api", router);

// Error handling

app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  console.error(err.stack);

  res.status(500).json({ error: "Internal Server Error" });
});

const PORT = 5001;

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});

export default app;
