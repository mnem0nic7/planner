import path from "path";
import { fileURLToPath } from "url";
import express from "express";
import type { Request, Response, NextFunction } from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import { projectRoutes } from "./routes/projects.js";
import { taskRoutes } from "./routes/tasks.js";
import { tagRoutes } from "./routes/tags.js";
import { chatRoutes } from "./routes/chat.js";

const app = express();

// Security headers
app.use(helmet({
  contentSecurityPolicy: process.env.NODE_ENV === "production" ? {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      connectSrc: ["'self'"],
      imgSrc: ["'self'", "data:"],
    },
  } : false,
}));

// Rate limit the AI chat endpoint to prevent runaway API costs
const chatLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 30,
  message: { error: "Too many requests, please try again later" },
  standardHeaders: true,
  legacyHeaders: false,
});
app.use("/api/chat", chatLimiter);

// CORS: in production, allow same-origin only; in dev, also allow Vite dev server
const port = process.env.PORT || 3001;
const allowedOrigins = process.env.NODE_ENV === "production"
  ? [`http://localhost:${port}`]
  : ["http://localhost:5173", `http://localhost:${port}`];
app.use(cors({
  origin: (origin, callback) => {
    // Allow same-origin requests (no origin header) and allowed origins
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error("Not allowed by CORS"));
    }
  },
}));

// Body size limit: 50KB is generous for JSON payloads
app.use(express.json({ limit: "50kb" }));

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok" });
});

app.use("/api/projects", projectRoutes);
app.use("/api", taskRoutes);
app.use("/api/tags", tagRoutes);
app.use("/api", chatRoutes);

// In production, serve the built client as static files
if (process.env.NODE_ENV === "production") {
  const __dirname = path.dirname(fileURLToPath(import.meta.url));
  const clientDist = path.resolve(__dirname, "../../client/dist");

  // Cache hashed assets for 1 year; index.html always fetched fresh
  app.use(express.static(clientDist, { maxAge: "1y", index: false }));

  // SPA fallback: serve index.html for non-API routes (no cache)
  app.get("/{*path}", (_req, res) => {
    res.setHeader("Cache-Control", "no-cache");
    res.sendFile(path.join(clientDist, "index.html"));
  });
}

// Global error handler — never leak stack traces to clients
app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  console.error("Unhandled error:", err.message);
  if (!res.headersSent) {
    res.status(500).json({ error: "Internal server error" });
  }
});

export { app };
