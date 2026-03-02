import path from "path";
import { fileURLToPath } from "url";
import express from "express";
import cors from "cors";
import { projectRoutes } from "./routes/projects.js";
import { taskRoutes } from "./routes/tasks.js";
import { tagRoutes } from "./routes/tags.js";
import { chatRoutes } from "./routes/chat.js";

const app = express();

app.use(cors());
app.use(express.json());

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

export { app };
