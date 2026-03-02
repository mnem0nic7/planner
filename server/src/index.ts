import { execFileSync } from "child_process";
import { app } from "./app.js";

const PORT = process.env.PORT || 3001;

// Run database migrations on startup
if (process.env.NODE_ENV === "production") {
  console.log("Running database migrations...");
  execFileSync("npx", ["prisma", "db", "push", "--schema=server/prisma/schema.prisma", "--skip-generate"], {
    cwd: "/app",
    stdio: "inherit",
  });
  console.log("Migrations complete.");
}

if (!process.env.OPENAI_API_KEY) {
  console.warn("WARNING: OPENAI_API_KEY is not set. AI assistant will not work.");
}

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
