import path from "path";
import { fileURLToPath } from "url";
import express from "express";
import type { Request, Response, NextFunction } from "express";
import cors from "cors";
import helmet from "helmet";
import { projectRoutes } from "./routes/projects.js";
import { taskRoutes } from "./routes/tasks.js";
import { tagRoutes } from "./routes/tags.js";
import { chatRoutes } from "./routes/chat.js";

const app = express();

// Security headers
app.use(helmet({
  contentSecurityPolicy: false, // CSP handled by Vite in dev, static files in prod
}));

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

  app.use(express.static(clientDist));

  // SPA fallback: serve index.html for non-API routes
  app.get("/{*path}", (_req, res) => {
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
