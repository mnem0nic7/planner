# Planner Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a personal work planner web app with projects, tasks (priorities, due dates, notes), and tags.

**Architecture:** React SPA communicates with an Express REST API over HTTP. Prisma ORM manages a SQLite database. Both client and server use TypeScript and live in an npm workspaces monorepo.

**Tech Stack:** React 19, Vite, Tailwind CSS v4, Express 5, Prisma, SQLite (better-sqlite3), Vitest, Supertest, React Testing Library

---

## Task 1: Scaffold the Monorepo

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `.gitignore`

**Step 1: Create root package.json with workspaces**

```json
{
  "name": "planner",
  "private": true,
  "workspaces": ["client", "server"],
  "scripts": {
    "dev": "npm run dev --workspace=server & npm run dev --workspace=client",
    "build": "npm run build --workspace=server && npm run build --workspace=client",
    "test": "npm run test --workspace=server && npm run test --workspace=client"
  }
}
```

**Step 2: Create root tsconfig.json (base config)**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "esModuleInterop": true,
    "strict": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "isolatedModules": true
  }
}
```

**Step 3: Create .gitignore**

```
node_modules/
dist/
*.db
*.db-journal
.env
.env.local
```

**Step 4: Commit**

```bash
git add package.json tsconfig.json .gitignore
git commit -m "feat: scaffold monorepo with npm workspaces"
```

---

## Task 2: Set Up Server Project

**Files:**
- Create: `server/package.json`
- Create: `server/tsconfig.json`
- Create: `server/src/index.ts`

**Step 1: Create server/package.json**

```json
{
  "name": "planner-server",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "tsx watch src/index.ts",
    "build": "tsc",
    "start": "node dist/index.js",
    "test": "vitest run",
    "test:watch": "vitest",
    "db:push": "prisma db push",
    "db:studio": "prisma studio",
    "db:seed": "tsx prisma/seed.ts"
  },
  "dependencies": {
    "@prisma/client": "^6.4.0",
    "cors": "^2.8.5",
    "express": "^5.1.0"
  },
  "devDependencies": {
    "@types/cors": "^2.8.17",
    "@types/express": "^5.0.0",
    "@types/node": "^22.0.0",
    "@types/supertest": "^6.0.2",
    "prisma": "^6.4.0",
    "supertest": "^7.0.0",
    "tsx": "^4.19.0",
    "typescript": "^5.7.0",
    "vitest": "^3.0.0"
  }
}
```

**Step 2: Create server/tsconfig.json**

```json
{
  "extends": "../tsconfig.json",
  "compilerOptions": {
    "outDir": "dist",
    "rootDir": "src"
  },
  "include": ["src/**/*"]
}
```

**Step 3: Create server/src/index.ts (minimal Express server)**

```typescript
import express from "express";
import cors from "cors";

const app = express();

app.use(cors());
app.use(express.json());

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok" });
});

const PORT = process.env.PORT || 3001;

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});

export { app };
```

**Step 4: Install dependencies**

Run: `npm install` (from project root)

**Step 5: Verify server starts**

Run: `npm run dev --workspace=server`
Expected: "Server running on http://localhost:3001"
Kill the dev server after verifying.

**Step 6: Commit**

```bash
git add server/
git commit -m "feat: set up Express server with TypeScript"
```

---

## Task 3: Define Prisma Schema and Database

**Files:**
- Create: `server/prisma/schema.prisma`
- Create: `server/prisma/seed.ts`

**Step 1: Create Prisma schema**

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "sqlite"
  url      = env("DATABASE_URL")
}

enum Priority {
  LOW
  MEDIUM
  HIGH
  URGENT
}

model Project {
  id          String   @id @default(cuid())
  name        String
  description String?
  color       String?
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
  tasks       Task[]
}

model Task {
  id          String    @id @default(cuid())
  title       String
  description String?
  priority    Priority  @default(MEDIUM)
  dueDate     DateTime?
  completed   Boolean   @default(false)
  completedAt DateTime?
  sortOrder   Int       @default(0)
  createdAt   DateTime  @default(now())
  updatedAt   DateTime  @updatedAt
  project     Project   @relation(fields: [projectId], references: [id], onDelete: Cascade)
  projectId   String
  tags        TaskTag[]
}

model Tag {
  id    String    @id @default(cuid())
  name  String    @unique
  color String?
  tasks TaskTag[]
}

model TaskTag {
  task   Task   @relation(fields: [taskId], references: [id], onDelete: Cascade)
  taskId String
  tag    Tag    @relation(fields: [tagId], references: [id], onDelete: Cascade)
  tagId  String

  @@id([taskId, tagId])
}
```

**Step 2: Create server/.env**

```
DATABASE_URL="file:./dev.db"
```

**Step 3: Create a Prisma client singleton**

Create `server/src/db.ts`:

```typescript
import { PrismaClient } from "@prisma/client";

export const prisma = new PrismaClient();
```

**Step 4: Push schema to database**

Run: `cd server && npx prisma db push`
Expected: "Your database is now in sync with your Prisma schema."

**Step 5: Create seed file**

Create `server/prisma/seed.ts`:

```typescript
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  // Clean existing data
  await prisma.taskTag.deleteMany();
  await prisma.task.deleteMany();
  await prisma.tag.deleteMany();
  await prisma.project.deleteMany();

  const workTag = await prisma.tag.create({
    data: { name: "work", color: "#3b82f6" },
  });

  const bugTag = await prisma.tag.create({
    data: { name: "bug", color: "#ef4444" },
  });

  const project = await prisma.project.create({
    data: {
      name: "Getting Started",
      description: "Your first project — feel free to delete it.",
      color: "#8b5cf6",
      tasks: {
        create: [
          {
            title: "Explore the planner",
            priority: "LOW",
            sortOrder: 0,
            tags: { create: [{ tagId: workTag.id }] },
          },
          {
            title: "Create your first real project",
            priority: "MEDIUM",
            sortOrder: 1,
          },
          {
            title: "Add some tasks with due dates",
            priority: "HIGH",
            dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
            sortOrder: 2,
          },
        ],
      },
    },
  });

  console.log(`Seeded project "${project.name}" with 3 tasks and 2 tags`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
```

**Step 6: Run seed**

Run: `cd server && npx tsx prisma/seed.ts`
Expected: 'Seeded project "Getting Started" with 3 tasks and 2 tags'

**Step 7: Commit**

```bash
git add server/prisma/ server/src/db.ts server/.env
git commit -m "feat: add Prisma schema with Project, Task, Tag models and seed data"
```

---

## Task 4: Project API Routes (TDD)

**Files:**
- Create: `server/src/routes/projects.ts`
- Modify: `server/src/index.ts`
- Create: `server/src/app.ts` (extract Express app for testing)
- Create: `server/src/__tests__/projects.test.ts`
- Create: `server/vitest.config.ts`

**Step 1: Extract Express app into app.ts for testability**

Create `server/src/app.ts`:

```typescript
import express from "express";
import cors from "cors";

const app = express();

app.use(cors());
app.use(express.json());

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok" });
});

export { app };
```

Update `server/src/index.ts`:

```typescript
import { app } from "./app.js";

const PORT = process.env.PORT || 3001;

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
```

**Step 2: Create vitest config**

Create `server/vitest.config.ts`:

```typescript
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    setupFiles: ["./src/__tests__/setup.ts"],
  },
});
```

Create `server/src/__tests__/setup.ts`:

```typescript
import { prisma } from "../db.js";
import { beforeEach, afterAll } from "vitest";

beforeEach(async () => {
  await prisma.taskTag.deleteMany();
  await prisma.task.deleteMany();
  await prisma.tag.deleteMany();
  await prisma.project.deleteMany();
});

afterAll(async () => {
  await prisma.$disconnect();
});
```

**Step 3: Write failing tests for project CRUD**

Create `server/src/__tests__/projects.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import request from "supertest";
import { app } from "../app.js";
import { prisma } from "../db.js";

describe("Projects API", () => {
  describe("GET /api/projects", () => {
    it("returns empty array when no projects exist", async () => {
      const res = await request(app).get("/api/projects");
      expect(res.status).toBe(200);
      expect(res.body).toEqual([]);
    });

    it("returns all projects", async () => {
      await prisma.project.create({ data: { name: "Test Project" } });
      const res = await request(app).get("/api/projects");
      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(1);
      expect(res.body[0].name).toBe("Test Project");
    });
  });

  describe("POST /api/projects", () => {
    it("creates a project", async () => {
      const res = await request(app)
        .post("/api/projects")
        .send({ name: "New Project", color: "#ff0000" });
      expect(res.status).toBe(201);
      expect(res.body.name).toBe("New Project");
      expect(res.body.color).toBe("#ff0000");
      expect(res.body.id).toBeDefined();
    });

    it("rejects project without name", async () => {
      const res = await request(app).post("/api/projects").send({});
      expect(res.status).toBe(400);
    });
  });

  describe("GET /api/projects/:id", () => {
    it("returns project with tasks", async () => {
      const project = await prisma.project.create({
        data: {
          name: "Test",
          tasks: { create: [{ title: "Task 1", sortOrder: 0 }] },
        },
      });
      const res = await request(app).get(`/api/projects/${project.id}`);
      expect(res.status).toBe(200);
      expect(res.body.name).toBe("Test");
      expect(res.body.tasks).toHaveLength(1);
    });

    it("returns 404 for missing project", async () => {
      const res = await request(app).get("/api/projects/nonexistent");
      expect(res.status).toBe(404);
    });
  });

  describe("PATCH /api/projects/:id", () => {
    it("updates a project", async () => {
      const project = await prisma.project.create({ data: { name: "Old" } });
      const res = await request(app)
        .patch(`/api/projects/${project.id}`)
        .send({ name: "New" });
      expect(res.status).toBe(200);
      expect(res.body.name).toBe("New");
    });
  });

  describe("DELETE /api/projects/:id", () => {
    it("deletes a project and its tasks", async () => {
      const project = await prisma.project.create({
        data: {
          name: "Delete Me",
          tasks: { create: [{ title: "Task", sortOrder: 0 }] },
        },
      });
      const res = await request(app).delete(`/api/projects/${project.id}`);
      expect(res.status).toBe(204);

      const tasks = await prisma.task.findMany({
        where: { projectId: project.id },
      });
      expect(tasks).toHaveLength(0);
    });
  });
});
```

**Step 4: Run tests — expect FAIL**

Run: `cd server && npx vitest run`
Expected: All tests fail (routes don't exist yet)

**Step 5: Implement project routes**

Create `server/src/routes/projects.ts`:

```typescript
import { Router } from "express";
import { prisma } from "../db.js";

const router = Router();

// GET /api/projects
router.get("/", async (_req, res) => {
  const projects = await prisma.project.findMany({
    include: { _count: { select: { tasks: true } } },
    orderBy: { createdAt: "desc" },
  });
  res.json(projects);
});

// POST /api/projects
router.post("/", async (req, res) => {
  const { name, description, color } = req.body;
  if (!name) {
    res.status(400).json({ error: "Name is required" });
    return;
  }
  const project = await prisma.project.create({
    data: { name, description, color },
  });
  res.status(201).json(project);
});

// GET /api/projects/:id
router.get("/:id", async (req, res) => {
  const project = await prisma.project.findUnique({
    where: { id: req.params.id },
    include: {
      tasks: {
        include: { tags: { include: { tag: true } } },
        orderBy: { sortOrder: "asc" },
      },
    },
  });
  if (!project) {
    res.status(404).json({ error: "Project not found" });
    return;
  }
  res.json(project);
});

// PATCH /api/projects/:id
router.patch("/:id", async (req, res) => {
  const { name, description, color } = req.body;
  const project = await prisma.project.update({
    where: { id: req.params.id },
    data: {
      ...(name !== undefined && { name }),
      ...(description !== undefined && { description }),
      ...(color !== undefined && { color }),
    },
  });
  res.json(project);
});

// DELETE /api/projects/:id
router.delete("/:id", async (req, res) => {
  await prisma.project.delete({ where: { id: req.params.id } });
  res.status(204).send();
});

export { router as projectRoutes };
```

**Step 6: Register routes in app.ts**

Update `server/src/app.ts` to import and use:

```typescript
import express from "express";
import cors from "cors";
import { projectRoutes } from "./routes/projects.js";

const app = express();

app.use(cors());
app.use(express.json());

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok" });
});

app.use("/api/projects", projectRoutes);

export { app };
```

**Step 7: Run tests — expect PASS**

Run: `cd server && npx vitest run`
Expected: All project tests pass

**Step 8: Commit**

```bash
git add server/
git commit -m "feat: add project CRUD API with tests"
```

---

## Task 5: Task API Routes (TDD)

**Files:**
- Create: `server/src/routes/tasks.ts`
- Modify: `server/src/app.ts`
- Create: `server/src/__tests__/tasks.test.ts`

**Step 1: Write failing tests for task CRUD**

Create `server/src/__tests__/tasks.test.ts`:

```typescript
import { describe, it, expect, beforeEach } from "vitest";
import request from "supertest";
import { app } from "../app.js";
import { prisma } from "../db.js";

describe("Tasks API", () => {
  let projectId: string;

  beforeEach(async () => {
    const project = await prisma.project.create({ data: { name: "Test" } });
    projectId = project.id;
  });

  describe("GET /api/projects/:id/tasks", () => {
    it("returns tasks for a project sorted by sortOrder", async () => {
      await prisma.task.createMany({
        data: [
          { title: "Second", projectId, sortOrder: 1 },
          { title: "First", projectId, sortOrder: 0 },
        ],
      });
      const res = await request(app).get(`/api/projects/${projectId}/tasks`);
      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(2);
      expect(res.body[0].title).toBe("First");
      expect(res.body[1].title).toBe("Second");
    });
  });

  describe("POST /api/projects/:id/tasks", () => {
    it("creates a task in a project", async () => {
      const res = await request(app)
        .post(`/api/projects/${projectId}/tasks`)
        .send({ title: "New Task", priority: "HIGH" });
      expect(res.status).toBe(201);
      expect(res.body.title).toBe("New Task");
      expect(res.body.priority).toBe("HIGH");
      expect(res.body.projectId).toBe(projectId);
    });

    it("rejects task without title", async () => {
      const res = await request(app)
        .post(`/api/projects/${projectId}/tasks`)
        .send({});
      expect(res.status).toBe(400);
    });

    it("auto-sets sortOrder to end of list", async () => {
      await prisma.task.create({
        data: { title: "Existing", projectId, sortOrder: 0 },
      });
      const res = await request(app)
        .post(`/api/projects/${projectId}/tasks`)
        .send({ title: "New" });
      expect(res.body.sortOrder).toBe(1);
    });
  });

  describe("PATCH /api/tasks/:id", () => {
    it("updates task fields", async () => {
      const task = await prisma.task.create({
        data: { title: "Old", projectId, sortOrder: 0 },
      });
      const res = await request(app)
        .patch(`/api/tasks/${task.id}`)
        .send({ title: "New", priority: "URGENT", description: "# Notes" });
      expect(res.status).toBe(200);
      expect(res.body.title).toBe("New");
      expect(res.body.priority).toBe("URGENT");
      expect(res.body.description).toBe("# Notes");
    });
  });

  describe("PATCH /api/tasks/:id/complete", () => {
    it("toggles completion on", async () => {
      const task = await prisma.task.create({
        data: { title: "Do it", projectId, sortOrder: 0 },
      });
      const res = await request(app).patch(`/api/tasks/${task.id}/complete`);
      expect(res.status).toBe(200);
      expect(res.body.completed).toBe(true);
      expect(res.body.completedAt).toBeDefined();
    });

    it("toggles completion off", async () => {
      const task = await prisma.task.create({
        data: {
          title: "Done",
          projectId,
          sortOrder: 0,
          completed: true,
          completedAt: new Date(),
        },
      });
      const res = await request(app).patch(`/api/tasks/${task.id}/complete`);
      expect(res.status).toBe(200);
      expect(res.body.completed).toBe(false);
      expect(res.body.completedAt).toBeNull();
    });
  });

  describe("PATCH /api/tasks/reorder", () => {
    it("batch updates sort order", async () => {
      const t1 = await prisma.task.create({
        data: { title: "A", projectId, sortOrder: 0 },
      });
      const t2 = await prisma.task.create({
        data: { title: "B", projectId, sortOrder: 1 },
      });
      const res = await request(app)
        .patch("/api/tasks/reorder")
        .send({
          items: [
            { id: t1.id, sortOrder: 1 },
            { id: t2.id, sortOrder: 0 },
          ],
        });
      expect(res.status).toBe(200);

      const tasks = await prisma.task.findMany({
        where: { projectId },
        orderBy: { sortOrder: "asc" },
      });
      expect(tasks[0].title).toBe("B");
      expect(tasks[1].title).toBe("A");
    });
  });

  describe("DELETE /api/tasks/:id", () => {
    it("deletes a task", async () => {
      const task = await prisma.task.create({
        data: { title: "Delete me", projectId, sortOrder: 0 },
      });
      const res = await request(app).delete(`/api/tasks/${task.id}`);
      expect(res.status).toBe(204);
    });
  });
});
```

**Step 2: Run tests — expect FAIL**

Run: `cd server && npx vitest run src/__tests__/tasks.test.ts`
Expected: All task tests fail

**Step 3: Implement task routes**

Create `server/src/routes/tasks.ts`:

```typescript
import { Router } from "express";
import { prisma } from "../db.js";

const router = Router();

// GET /api/projects/:id/tasks
router.get("/projects/:id/tasks", async (req, res) => {
  const tasks = await prisma.task.findMany({
    where: { projectId: req.params.id },
    include: { tags: { include: { tag: true } } },
    orderBy: { sortOrder: "asc" },
  });
  res.json(tasks);
});

// POST /api/projects/:id/tasks
router.post("/projects/:id/tasks", async (req, res) => {
  const { title, description, priority, dueDate } = req.body;
  if (!title) {
    res.status(400).json({ error: "Title is required" });
    return;
  }

  // Auto-set sortOrder to end of list
  const maxSort = await prisma.task.aggregate({
    where: { projectId: req.params.id },
    _max: { sortOrder: true },
  });
  const sortOrder = (maxSort._max.sortOrder ?? -1) + 1;

  const task = await prisma.task.create({
    data: {
      title,
      description,
      priority: priority || "MEDIUM",
      dueDate: dueDate ? new Date(dueDate) : null,
      sortOrder,
      projectId: req.params.id,
    },
    include: { tags: { include: { tag: true } } },
  });
  res.status(201).json(task);
});

// PATCH /api/tasks/:id
router.patch("/tasks/:id", async (req, res) => {
  const { title, description, priority, dueDate } = req.body;
  const task = await prisma.task.update({
    where: { id: req.params.id },
    data: {
      ...(title !== undefined && { title }),
      ...(description !== undefined && { description }),
      ...(priority !== undefined && { priority }),
      ...(dueDate !== undefined && { dueDate: dueDate ? new Date(dueDate) : null }),
    },
    include: { tags: { include: { tag: true } } },
  });
  res.json(task);
});

// PATCH /api/tasks/:id/complete
router.patch("/tasks/:id/complete", async (req, res) => {
  const existing = await prisma.task.findUnique({
    where: { id: req.params.id },
  });
  if (!existing) {
    res.status(404).json({ error: "Task not found" });
    return;
  }

  const task = await prisma.task.update({
    where: { id: req.params.id },
    data: {
      completed: !existing.completed,
      completedAt: existing.completed ? null : new Date(),
    },
    include: { tags: { include: { tag: true } } },
  });
  res.json(task);
});

// PATCH /api/tasks/reorder
router.patch("/tasks/reorder", async (req, res) => {
  const { items } = req.body as { items: { id: string; sortOrder: number }[] };
  await prisma.$transaction(
    items.map((item) =>
      prisma.task.update({
        where: { id: item.id },
        data: { sortOrder: item.sortOrder },
      })
    )
  );
  res.json({ success: true });
});

// DELETE /api/tasks/:id
router.delete("/tasks/:id", async (req, res) => {
  await prisma.task.delete({ where: { id: req.params.id } });
  res.status(204).send();
});

export { router as taskRoutes };
```

**Step 4: Register task routes in app.ts**

Update `server/src/app.ts`:

```typescript
import express from "express";
import cors from "cors";
import { projectRoutes } from "./routes/projects.js";
import { taskRoutes } from "./routes/tasks.js";

const app = express();

app.use(cors());
app.use(express.json());

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok" });
});

app.use("/api/projects", projectRoutes);
app.use("/api", taskRoutes);

export { app };
```

**Step 5: Run tests — expect PASS**

Run: `cd server && npx vitest run`
Expected: All project + task tests pass

**Step 6: Commit**

```bash
git add server/
git commit -m "feat: add task CRUD API with completion toggle and reordering"
```

---

## Task 6: Tag API Routes (TDD)

**Files:**
- Create: `server/src/routes/tags.ts`
- Modify: `server/src/app.ts`
- Create: `server/src/__tests__/tags.test.ts`

**Step 1: Write failing tests for tags**

Create `server/src/__tests__/tags.test.ts`:

```typescript
import { describe, it, expect, beforeEach } from "vitest";
import request from "supertest";
import { app } from "../app.js";
import { prisma } from "../db.js";

describe("Tags API", () => {
  describe("GET /api/tags", () => {
    it("returns all tags", async () => {
      await prisma.tag.create({ data: { name: "work", color: "#3b82f6" } });
      const res = await request(app).get("/api/tags");
      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(1);
      expect(res.body[0].name).toBe("work");
    });
  });

  describe("POST /api/tags", () => {
    it("creates a tag", async () => {
      const res = await request(app)
        .post("/api/tags")
        .send({ name: "urgent", color: "#ef4444" });
      expect(res.status).toBe(201);
      expect(res.body.name).toBe("urgent");
    });

    it("rejects duplicate tag name", async () => {
      await prisma.tag.create({ data: { name: "dupe" } });
      const res = await request(app)
        .post("/api/tags")
        .send({ name: "dupe" });
      expect(res.status).toBe(409);
    });
  });

  describe("DELETE /api/tags/:id", () => {
    it("deletes a tag", async () => {
      const tag = await prisma.tag.create({ data: { name: "delete-me" } });
      const res = await request(app).delete(`/api/tags/${tag.id}`);
      expect(res.status).toBe(204);
    });
  });

  describe("Task-Tag association", () => {
    let taskId: string;
    let tagId: string;

    beforeEach(async () => {
      const project = await prisma.project.create({ data: { name: "P" } });
      const task = await prisma.task.create({
        data: { title: "T", projectId: project.id, sortOrder: 0 },
      });
      const tag = await prisma.tag.create({ data: { name: "label" } });
      taskId = task.id;
      tagId = tag.id;
    });

    it("adds a tag to a task", async () => {
      const res = await request(app)
        .post(`/api/tasks/${taskId}/tags`)
        .send({ tagId });
      expect(res.status).toBe(201);
    });

    it("removes a tag from a task", async () => {
      await prisma.taskTag.create({ data: { taskId, tagId } });
      const res = await request(app).delete(
        `/api/tasks/${taskId}/tags/${tagId}`
      );
      expect(res.status).toBe(204);
    });
  });
});
```

**Step 2: Run tests — expect FAIL**

Run: `cd server && npx vitest run src/__tests__/tags.test.ts`

**Step 3: Implement tag routes**

Create `server/src/routes/tags.ts`:

```typescript
import { Router } from "express";
import { prisma } from "../db.js";

const router = Router();

// GET /api/tags
router.get("/", async (_req, res) => {
  const tags = await prisma.tag.findMany({ orderBy: { name: "asc" } });
  res.json(tags);
});

// POST /api/tags
router.post("/", async (req, res) => {
  const { name, color } = req.body;
  if (!name) {
    res.status(400).json({ error: "Name is required" });
    return;
  }

  const existing = await prisma.tag.findUnique({ where: { name } });
  if (existing) {
    res.status(409).json({ error: "Tag already exists" });
    return;
  }

  const tag = await prisma.tag.create({ data: { name, color } });
  res.status(201).json(tag);
});

// DELETE /api/tags/:id
router.delete("/:id", async (req, res) => {
  await prisma.tag.delete({ where: { id: req.params.id } });
  res.status(204).send();
});

export { router as tagRoutes };
```

**Step 4: Add task-tag association routes to tasks.ts**

Append to `server/src/routes/tasks.ts`:

```typescript
// POST /api/tasks/:id/tags
router.post("/tasks/:id/tags", async (req, res) => {
  const { tagId } = req.body;
  await prisma.taskTag.create({
    data: { taskId: req.params.id, tagId },
  });
  res.status(201).json({ success: true });
});

// DELETE /api/tasks/:id/tags/:tagId
router.delete("/tasks/:id/tags/:tagId", async (req, res) => {
  await prisma.taskTag.delete({
    where: {
      taskId_tagId: { taskId: req.params.id, tagId: req.params.tagId },
    },
  });
  res.status(204).send();
});
```

**Step 5: Register tag routes in app.ts**

```typescript
import { tagRoutes } from "./routes/tags.js";
// ...
app.use("/api/tags", tagRoutes);
```

**Step 6: Run all tests — expect PASS**

Run: `cd server && npx vitest run`
Expected: All tests pass

**Step 7: Commit**

```bash
git add server/
git commit -m "feat: add tag CRUD and task-tag association API with tests"
```

---

## Task 7: Scaffold React Client

**Files:**
- Create: `client/` (entire Vite project)

**Step 1: Scaffold with Vite**

Run from project root:

```bash
npm create vite@latest client -- --template react-ts
```

**Step 2: Install Tailwind CSS v4**

```bash
cd client && npm install tailwindcss @tailwindcss/vite
```

Update `client/vite.config.ts`:

```typescript
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    proxy: {
      "/api": "http://localhost:3001",
    },
  },
});
```

Update `client/src/index.css`:

```css
@import "tailwindcss";
```

**Step 3: Clean up Vite boilerplate**

Remove default `App.css`, update `App.tsx` to minimal shell:

```tsx
function App() {
  return (
    <div className="min-h-screen bg-gray-50">
      <h1 className="text-2xl font-bold p-8">Planner</h1>
    </div>
  );
}

export default App;
```

**Step 4: Verify client starts**

Run: `cd client && npm run dev`
Expected: Opens on http://localhost:5173 showing "Planner"
Kill after verifying.

**Step 5: Install from root to link workspaces**

Run: `npm install` (from project root)

**Step 6: Commit**

```bash
git add client/ package-lock.json
git commit -m "feat: scaffold React client with Vite and Tailwind CSS"
```

---

## Task 8: API Client Library

**Files:**
- Create: `client/src/lib/api.ts`
- Create: `client/src/lib/types.ts`

**Step 1: Create shared types**

Create `client/src/lib/types.ts`:

```typescript
export type Priority = "LOW" | "MEDIUM" | "HIGH" | "URGENT";

export interface Project {
  id: string;
  name: string;
  description: string | null;
  color: string | null;
  createdAt: string;
  updatedAt: string;
  _count?: { tasks: number };
  tasks?: Task[];
}

export interface Tag {
  id: string;
  name: string;
  color: string | null;
}

export interface TaskTag {
  taskId: string;
  tagId: string;
  tag: Tag;
}

export interface Task {
  id: string;
  title: string;
  description: string | null;
  priority: Priority;
  dueDate: string | null;
  completed: boolean;
  completedAt: string | null;
  sortOrder: number;
  projectId: string;
  createdAt: string;
  updatedAt: string;
  tags: TaskTag[];
}
```

**Step 2: Create API client**

Create `client/src/lib/api.ts`:

```typescript
import type { Project, Task, Tag } from "./types";

const BASE = "/api";

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `Request failed: ${res.status}`);
  }
  if (res.status === 204) return undefined as T;
  return res.json();
}

// Projects
export const projects = {
  list: () => request<Project[]>("/projects"),
  get: (id: string) => request<Project>(`/projects/${id}`),
  create: (data: { name: string; description?: string; color?: string }) =>
    request<Project>("/projects", { method: "POST", body: JSON.stringify(data) }),
  update: (id: string, data: Partial<Pick<Project, "name" | "description" | "color">>) =>
    request<Project>(`/projects/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
  delete: (id: string) => request<void>(`/projects/${id}`, { method: "DELETE" }),
};

// Tasks
export const tasks = {
  list: (projectId: string) => request<Task[]>(`/projects/${projectId}/tasks`),
  create: (projectId: string, data: { title: string; priority?: string; dueDate?: string; description?: string }) =>
    request<Task>(`/projects/${projectId}/tasks`, { method: "POST", body: JSON.stringify(data) }),
  update: (id: string, data: Partial<Pick<Task, "title" | "description" | "priority" | "dueDate">>) =>
    request<Task>(`/tasks/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
  toggleComplete: (id: string) =>
    request<Task>(`/tasks/${id}/complete`, { method: "PATCH" }),
  reorder: (items: { id: string; sortOrder: number }[]) =>
    request<void>("/tasks/reorder", { method: "PATCH", body: JSON.stringify({ items }) }),
  delete: (id: string) => request<void>(`/tasks/${id}`, { method: "DELETE" }),
  addTag: (taskId: string, tagId: string) =>
    request<void>(`/tasks/${taskId}/tags`, { method: "POST", body: JSON.stringify({ tagId }) }),
  removeTag: (taskId: string, tagId: string) =>
    request<void>(`/tasks/${taskId}/tags/${tagId}`, { method: "DELETE" }),
};

// Tags
export const tags = {
  list: () => request<Tag[]>("/tags"),
  create: (data: { name: string; color?: string }) =>
    request<Tag>("/tags", { method: "POST", body: JSON.stringify(data) }),
  delete: (id: string) => request<void>(`/tags/${id}`, { method: "DELETE" }),
};
```

**Step 3: Commit**

```bash
git add client/src/lib/
git commit -m "feat: add TypeScript types and API client for all endpoints"
```

---

## Task 9: Layout Shell with Sidebar

**Files:**
- Create: `client/src/components/Layout.tsx`
- Create: `client/src/components/Sidebar.tsx`
- Modify: `client/src/App.tsx`

**Step 1: Create Sidebar component**

Create `client/src/components/Sidebar.tsx`:

```tsx
import { useEffect, useState } from "react";
import { projects as projectsApi, tags as tagsApi } from "../lib/api";
import type { Project, Tag } from "../lib/types";

interface SidebarProps {
  activeProjectId: string | null;
  activeView: "dashboard" | "project" | "all-tasks" | "due-soon";
  onSelectProject: (id: string) => void;
  onSelectView: (view: "dashboard" | "all-tasks" | "due-soon") => void;
}

export function Sidebar({ activeProjectId, activeView, onSelectProject, onSelectView }: SidebarProps) {
  const [projectList, setProjectList] = useState<Project[]>([]);
  const [tagList, setTagList] = useState<Tag[]>([]);

  useEffect(() => {
    projectsApi.list().then(setProjectList);
    tagsApi.list().then(setTagList);
  }, []);

  return (
    <aside className="w-64 bg-white border-r border-gray-200 h-screen flex flex-col">
      <div className="p-4 border-b border-gray-200">
        <h1 className="text-xl font-bold text-gray-900">Planner</h1>
      </div>

      <nav className="flex-1 overflow-y-auto p-3 space-y-1">
        <button
          onClick={() => onSelectView("dashboard")}
          className={`w-full text-left px-3 py-2 rounded text-sm font-medium ${
            activeView === "dashboard" ? "bg-blue-50 text-blue-700" : "text-gray-700 hover:bg-gray-100"
          }`}
        >
          Dashboard
        </button>
        <button
          onClick={() => onSelectView("all-tasks")}
          className={`w-full text-left px-3 py-2 rounded text-sm font-medium ${
            activeView === "all-tasks" ? "bg-blue-50 text-blue-700" : "text-gray-700 hover:bg-gray-100"
          }`}
        >
          All Tasks
        </button>
        <button
          onClick={() => onSelectView("due-soon")}
          className={`w-full text-left px-3 py-2 rounded text-sm font-medium ${
            activeView === "due-soon" ? "bg-blue-50 text-blue-700" : "text-gray-700 hover:bg-gray-100"
          }`}
        >
          Due Soon
        </button>

        <div className="pt-4">
          <h2 className="px-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Projects</h2>
          <div className="mt-2 space-y-1">
            {projectList.map((project) => (
              <button
                key={project.id}
                onClick={() => onSelectProject(project.id)}
                className={`w-full text-left px-3 py-2 rounded text-sm flex items-center gap-2 ${
                  activeProjectId === project.id ? "bg-blue-50 text-blue-700" : "text-gray-700 hover:bg-gray-100"
                }`}
              >
                {project.color && (
                  <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: project.color }} />
                )}
                {project.name}
              </button>
            ))}
          </div>
        </div>

        {tagList.length > 0 && (
          <div className="pt-4">
            <h2 className="px-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Tags</h2>
            <div className="mt-2 flex flex-wrap gap-1 px-3">
              {tagList.map((tag) => (
                <span
                  key={tag.id}
                  className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium"
                  style={{
                    backgroundColor: tag.color ? `${tag.color}20` : "#e5e7eb",
                    color: tag.color || "#374151",
                  }}
                >
                  {tag.name}
                </span>
              ))}
            </div>
          </div>
        )}
      </nav>
    </aside>
  );
}
```

**Step 2: Create Layout component**

Create `client/src/components/Layout.tsx`:

```tsx
import { ReactNode } from "react";
import { Sidebar } from "./Sidebar";

interface LayoutProps {
  children: ReactNode;
  activeProjectId: string | null;
  activeView: "dashboard" | "project" | "all-tasks" | "due-soon";
  onSelectProject: (id: string) => void;
  onSelectView: (view: "dashboard" | "all-tasks" | "due-soon") => void;
}

export function Layout({ children, activeProjectId, activeView, onSelectProject, onSelectView }: LayoutProps) {
  return (
    <div className="flex h-screen bg-gray-50">
      <Sidebar
        activeProjectId={activeProjectId}
        activeView={activeView}
        onSelectProject={onSelectProject}
        onSelectView={onSelectView}
      />
      <main className="flex-1 overflow-y-auto">
        {children}
      </main>
    </div>
  );
}
```

**Step 3: Wire up App.tsx with basic routing state**

```tsx
import { useState } from "react";
import { Layout } from "./components/Layout";

type View = "dashboard" | "project" | "all-tasks" | "due-soon";

function App() {
  const [view, setView] = useState<View>("dashboard");
  const [activeProjectId, setActiveProjectId] = useState<string | null>(null);

  const handleSelectProject = (id: string) => {
    setActiveProjectId(id);
    setView("project");
  };

  const handleSelectView = (v: "dashboard" | "all-tasks" | "due-soon") => {
    setActiveProjectId(null);
    setView(v);
  };

  return (
    <Layout
      activeProjectId={activeProjectId}
      activeView={view}
      onSelectProject={handleSelectProject}
      onSelectView={handleSelectView}
    >
      <div className="p-8">
        {view === "dashboard" && <h2 className="text-xl font-semibold">Dashboard</h2>}
        {view === "project" && <h2 className="text-xl font-semibold">Project: {activeProjectId}</h2>}
        {view === "all-tasks" && <h2 className="text-xl font-semibold">All Tasks</h2>}
        {view === "due-soon" && <h2 className="text-xl font-semibold">Due Soon</h2>}
      </div>
    </Layout>
  );
}

export default App;
```

**Step 4: Verify UI renders with sidebar**

Run both server and client, verify sidebar shows projects from seed data.

**Step 5: Commit**

```bash
git add client/
git commit -m "feat: add layout shell with sidebar navigation"
```

---

## Task 10: Dashboard Page

**Files:**
- Create: `client/src/pages/Dashboard.tsx`
- Create: `client/src/components/ProjectCard.tsx`
- Create: `client/src/components/CreateProjectDialog.tsx`
- Modify: `client/src/App.tsx`

**Step 1: Create ProjectCard component**

Create `client/src/components/ProjectCard.tsx`:

```tsx
import type { Project } from "../lib/types";

interface ProjectCardProps {
  project: Project;
  onClick: () => void;
}

export function ProjectCard({ project, onClick }: ProjectCardProps) {
  const taskCount = project._count?.tasks ?? 0;

  return (
    <button
      onClick={onClick}
      className="w-full text-left p-4 bg-white rounded-lg border border-gray-200 hover:border-gray-300 hover:shadow-sm transition-all"
    >
      <div className="flex items-center gap-2 mb-2">
        {project.color && (
          <span className="w-3 h-3 rounded-full" style={{ backgroundColor: project.color }} />
        )}
        <h3 className="font-semibold text-gray-900">{project.name}</h3>
      </div>
      {project.description && (
        <p className="text-sm text-gray-500 mb-3 line-clamp-2">{project.description}</p>
      )}
      <div className="text-xs text-gray-400">
        {taskCount} {taskCount === 1 ? "task" : "tasks"}
      </div>
    </button>
  );
}
```

**Step 2: Create CreateProjectDialog component**

Create `client/src/components/CreateProjectDialog.tsx`:

```tsx
import { useState } from "react";

interface CreateProjectDialogProps {
  open: boolean;
  onClose: () => void;
  onCreate: (data: { name: string; description?: string; color?: string }) => void;
}

const COLORS = ["#3b82f6", "#ef4444", "#10b981", "#f59e0b", "#8b5cf6", "#ec4899"];

export function CreateProjectDialog({ open, onClose, onCreate }: CreateProjectDialogProps) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [color, setColor] = useState(COLORS[0]);

  if (!open) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    onCreate({ name: name.trim(), description: description.trim() || undefined, color });
    setName("");
    setDescription("");
    setColor(COLORS[0]);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-white rounded-lg p-6 w-full max-w-md" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-lg font-semibold mb-4">New Project</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
            <input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Project name"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Optional description"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Color</label>
            <div className="flex gap-2">
              {COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setColor(c)}
                  className={`w-8 h-8 rounded-full border-2 ${color === c ? "border-gray-900" : "border-transparent"}`}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900">
              Cancel
            </button>
            <button
              type="submit"
              disabled={!name.trim()}
              className="px-4 py-2 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
            >
              Create
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
```

**Step 3: Create Dashboard page**

Create `client/src/pages/Dashboard.tsx`:

```tsx
import { useEffect, useState } from "react";
import { projects as projectsApi } from "../lib/api";
import type { Project } from "../lib/types";
import { ProjectCard } from "../components/ProjectCard";
import { CreateProjectDialog } from "../components/CreateProjectDialog";

interface DashboardProps {
  onSelectProject: (id: string) => void;
}

export function Dashboard({ onSelectProject }: DashboardProps) {
  const [projectList, setProjectList] = useState<Project[]>([]);
  const [showCreate, setShowCreate] = useState(false);

  const loadProjects = () => {
    projectsApi.list().then(setProjectList);
  };

  useEffect(() => { loadProjects(); }, []);

  const handleCreate = async (data: { name: string; description?: string; color?: string }) => {
    await projectsApi.create(data);
    loadProjects();
  };

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-gray-900">Dashboard</h2>
        <button
          onClick={() => setShowCreate(true)}
          className="px-4 py-2 bg-blue-600 text-white text-sm rounded hover:bg-blue-700"
        >
          + New Project
        </button>
      </div>

      {projectList.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <p className="text-lg mb-2">No projects yet</p>
          <p className="text-sm">Create your first project to get started.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {projectList.map((project) => (
            <ProjectCard key={project.id} project={project} onClick={() => onSelectProject(project.id)} />
          ))}
        </div>
      )}

      <CreateProjectDialog open={showCreate} onClose={() => setShowCreate(false)} onCreate={handleCreate} />
    </div>
  );
}
```

**Step 4: Wire Dashboard into App.tsx**

Replace the dashboard placeholder in App.tsx:

```tsx
import { Dashboard } from "./pages/Dashboard";
// ...
{view === "dashboard" && <Dashboard onSelectProject={handleSelectProject} />}
```

**Step 5: Verify dashboard renders with seed data**

Run both server and client. Dashboard should show "Getting Started" project card.

**Step 6: Commit**

```bash
git add client/
git commit -m "feat: add dashboard page with project cards and create dialog"
```

---

## Task 11: Project View Page

**Files:**
- Create: `client/src/pages/ProjectView.tsx`
- Create: `client/src/components/TaskRow.tsx`
- Create: `client/src/components/CreateTaskForm.tsx`
- Modify: `client/src/App.tsx`

**Step 1: Create TaskRow component**

Create `client/src/components/TaskRow.tsx`:

```tsx
import type { Task } from "../lib/types";

interface TaskRowProps {
  task: Task;
  onToggleComplete: (id: string) => void;
  onSelect: (task: Task) => void;
}

const PRIORITY_STYLES: Record<string, string> = {
  LOW: "bg-gray-100 text-gray-600",
  MEDIUM: "bg-blue-100 text-blue-700",
  HIGH: "bg-orange-100 text-orange-700",
  URGENT: "bg-red-100 text-red-700",
};

export function TaskRow({ task, onToggleComplete, onSelect }: TaskRowProps) {
  const isOverdue = task.dueDate && !task.completed && new Date(task.dueDate) < new Date();

  return (
    <div
      className={`flex items-center gap-3 p-3 bg-white border border-gray-200 rounded-lg hover:border-gray-300 transition-colors ${
        task.completed ? "opacity-60" : ""
      }`}
    >
      <input
        type="checkbox"
        checked={task.completed}
        onChange={() => onToggleComplete(task.id)}
        className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
      />
      <button
        onClick={() => onSelect(task)}
        className="flex-1 text-left min-w-0"
      >
        <span className={`text-sm ${task.completed ? "line-through text-gray-400" : "text-gray-900"}`}>
          {task.title}
        </span>
      </button>
      <div className="flex items-center gap-2 flex-shrink-0">
        {task.tags.map(({ tag }) => (
          <span
            key={tag.id}
            className="px-1.5 py-0.5 rounded text-xs"
            style={{
              backgroundColor: tag.color ? `${tag.color}20` : "#e5e7eb",
              color: tag.color || "#374151",
            }}
          >
            {tag.name}
          </span>
        ))}
        <span className={`px-2 py-0.5 rounded text-xs font-medium ${PRIORITY_STYLES[task.priority]}`}>
          {task.priority}
        </span>
        {task.dueDate && (
          <span className={`text-xs ${isOverdue ? "text-red-600 font-medium" : "text-gray-400"}`}>
            {new Date(task.dueDate).toLocaleDateString()}
          </span>
        )}
      </div>
    </div>
  );
}
```

**Step 2: Create inline CreateTaskForm**

Create `client/src/components/CreateTaskForm.tsx`:

```tsx
import { useState } from "react";
import type { Priority } from "../lib/types";

interface CreateTaskFormProps {
  onCreate: (data: { title: string; priority?: Priority; dueDate?: string }) => void;
}

export function CreateTaskForm({ onCreate }: CreateTaskFormProps) {
  const [title, setTitle] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    onCreate({ title: title.trim() });
    setTitle("");
  };

  return (
    <form onSubmit={handleSubmit} className="flex gap-2">
      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Add a task..."
        className="flex-1 border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
      />
      <button
        type="submit"
        disabled={!title.trim()}
        className="px-4 py-2 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 disabled:opacity-50"
      >
        Add
      </button>
    </form>
  );
}
```

**Step 3: Create ProjectView page**

Create `client/src/pages/ProjectView.tsx`:

```tsx
import { useEffect, useState } from "react";
import { projects as projectsApi, tasks as tasksApi } from "../lib/api";
import type { Project, Task } from "../lib/types";
import { TaskRow } from "../components/TaskRow";
import { CreateTaskForm } from "../components/CreateTaskForm";

interface ProjectViewProps {
  projectId: string;
}

export function ProjectView({ projectId }: ProjectViewProps) {
  const [project, setProject] = useState<Project | null>(null);
  const [taskList, setTaskList] = useState<Task[]>([]);

  const load = async () => {
    const p = await projectsApi.get(projectId);
    setProject(p);
    setTaskList(p.tasks || []);
  };

  useEffect(() => { load(); }, [projectId]);

  const handleToggleComplete = async (taskId: string) => {
    await tasksApi.toggleComplete(taskId);
    load();
  };

  const handleCreateTask = async (data: { title: string }) => {
    await tasksApi.create(projectId, data);
    load();
  };

  if (!project) return <div className="p-8 text-gray-400">Loading...</div>;

  const completedCount = taskList.filter((t) => t.completed).length;

  return (
    <div className="p-8 max-w-3xl">
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-1">
          {project.color && (
            <span className="w-3 h-3 rounded-full" style={{ backgroundColor: project.color }} />
          )}
          <h2 className="text-2xl font-bold text-gray-900">{project.name}</h2>
        </div>
        {project.description && <p className="text-sm text-gray-500">{project.description}</p>}
        <p className="text-xs text-gray-400 mt-1">
          {completedCount}/{taskList.length} tasks completed
        </p>
      </div>

      <div className="mb-4">
        <CreateTaskForm onCreate={handleCreateTask} />
      </div>

      <div className="space-y-2">
        {taskList.length === 0 ? (
          <p className="text-center py-8 text-gray-400 text-sm">No tasks yet. Add one above.</p>
        ) : (
          taskList.map((task) => (
            <TaskRow
              key={task.id}
              task={task}
              onToggleComplete={handleToggleComplete}
              onSelect={() => {/* Task detail panel — Task 12 */}}
            />
          ))
        )}
      </div>
    </div>
  );
}
```

**Step 4: Wire ProjectView into App.tsx**

```tsx
import { ProjectView } from "./pages/ProjectView";
// ...
{view === "project" && activeProjectId && <ProjectView projectId={activeProjectId} />}
```

**Step 5: Verify project view shows tasks**

Navigate to a project from dashboard. Should see tasks from seed data with checkboxes.

**Step 6: Commit**

```bash
git add client/
git commit -m "feat: add project view with task list, completion toggle, and quick-add form"
```

---

## Task 12: Task Detail Panel (Edit, Delete, Tags)

**Files:**
- Create: `client/src/components/TaskDetailPanel.tsx`
- Modify: `client/src/pages/ProjectView.tsx`

**Step 1: Create TaskDetailPanel**

Create `client/src/components/TaskDetailPanel.tsx`:

```tsx
import { useState, useEffect } from "react";
import { tasks as tasksApi, tags as tagsApi } from "../lib/api";
import type { Task, Tag, Priority } from "../lib/types";

interface TaskDetailPanelProps {
  task: Task;
  onClose: () => void;
  onUpdate: () => void;
}

const PRIORITIES: Priority[] = ["LOW", "MEDIUM", "HIGH", "URGENT"];

export function TaskDetailPanel({ task, onClose, onUpdate }: TaskDetailPanelProps) {
  const [title, setTitle] = useState(task.title);
  const [description, setDescription] = useState(task.description || "");
  const [priority, setPriority] = useState<Priority>(task.priority);
  const [dueDate, setDueDate] = useState(task.dueDate?.split("T")[0] || "");
  const [allTags, setAllTags] = useState<Tag[]>([]);

  useEffect(() => {
    tagsApi.list().then(setAllTags);
  }, []);

  const handleSave = async () => {
    await tasksApi.update(task.id, {
      title,
      description: description || undefined,
      priority,
      dueDate: dueDate || undefined,
    });
    onUpdate();
  };

  const handleDelete = async () => {
    if (!confirm("Delete this task?")) return;
    await tasksApi.delete(task.id);
    onUpdate();
    onClose();
  };

  const handleToggleTag = async (tag: Tag) => {
    const hasTag = task.tags.some((t) => t.tagId === tag.id);
    if (hasTag) {
      await tasksApi.removeTag(task.id, tag.id);
    } else {
      await tasksApi.addTag(task.id, tag.id);
    }
    onUpdate();
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex justify-end z-50" onClick={onClose}>
      <div className="w-full max-w-md bg-white h-full overflow-y-auto p-6" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-semibold">Task Details</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl">&times;</button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Title</label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onBlur={handleSave}
              className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Priority</label>
            <select
              value={priority}
              onChange={(e) => { setPriority(e.target.value as Priority); }}
              onBlur={handleSave}
              className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {PRIORITIES.map((p) => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Due Date</label>
            <input
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              onBlur={handleSave}
              className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Notes (Markdown)</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              onBlur={handleSave}
              rows={6}
              className="w-full border border-gray-300 rounded px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Add notes..."
            />
          </div>

          {allTags.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Tags</label>
              <div className="flex flex-wrap gap-2">
                {allTags.map((tag) => {
                  const active = task.tags.some((t) => t.tagId === tag.id);
                  return (
                    <button
                      key={tag.id}
                      onClick={() => handleToggleTag(tag)}
                      className={`px-2 py-1 rounded text-xs font-medium border ${
                        active ? "border-blue-500 bg-blue-50" : "border-gray-300 bg-white"
                      }`}
                      style={active && tag.color ? { borderColor: tag.color, backgroundColor: `${tag.color}20` } : {}}
                    >
                      {tag.name}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          <div className="pt-4 border-t">
            <button onClick={handleDelete} className="text-sm text-red-600 hover:text-red-800">
              Delete task
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
```

**Step 2: Wire TaskDetailPanel into ProjectView**

Update `client/src/pages/ProjectView.tsx` to add state for selected task and render the panel:

```tsx
const [selectedTask, setSelectedTask] = useState<Task | null>(null);

// In TaskRow onSelect:
onSelect={(task) => setSelectedTask(task)}

// After the task list:
{selectedTask && (
  <TaskDetailPanel
    task={selectedTask}
    onClose={() => setSelectedTask(null)}
    onUpdate={() => { load(); setSelectedTask(null); }}
  />
)}
```

**Step 3: Verify task detail panel works**

Click a task, edit fields, toggle tags, delete.

**Step 4: Commit**

```bash
git add client/
git commit -m "feat: add task detail panel with edit, tags, and delete"
```

---

## Task 13: All Tasks and Due Soon Views

**Files:**
- Create: `client/src/pages/AllTasks.tsx`
- Create: `client/src/pages/DueSoon.tsx`
- Modify: `client/src/App.tsx`

**Step 1: Create AllTasks page**

This requires a new API endpoint. Add to `server/src/routes/tasks.ts`:

```typescript
// GET /api/tasks (all tasks across projects)
router.get("/tasks", async (_req, res) => {
  const tasks = await prisma.task.findMany({
    include: { tags: { include: { tag: true } }, project: true },
    orderBy: { createdAt: "desc" },
  });
  res.json(tasks);
});
```

Create `client/src/pages/AllTasks.tsx`:

```tsx
import { useEffect, useState } from "react";
import type { Task } from "../lib/types";
import { TaskRow } from "../components/TaskRow";
import { tasks as tasksApi } from "../lib/api";

export function AllTasks() {
  const [taskList, setTaskList] = useState<Task[]>([]);

  const load = async () => {
    const res = await fetch("/api/tasks");
    setTaskList(await res.json());
  };

  useEffect(() => { load(); }, []);

  const handleToggle = async (id: string) => {
    await tasksApi.toggleComplete(id);
    load();
  };

  return (
    <div className="p-8 max-w-3xl">
      <h2 className="text-2xl font-bold text-gray-900 mb-6">All Tasks</h2>
      <div className="space-y-2">
        {taskList.length === 0 ? (
          <p className="text-center py-8 text-gray-400 text-sm">No tasks yet.</p>
        ) : (
          taskList.map((task) => (
            <TaskRow key={task.id} task={task} onToggleComplete={handleToggle} onSelect={() => {}} />
          ))
        )}
      </div>
    </div>
  );
}
```

**Step 2: Create DueSoon page**

Add server endpoint in `server/src/routes/tasks.ts`:

```typescript
// GET /api/tasks/due-soon
router.get("/tasks/due-soon", async (_req, res) => {
  const nextWeek = new Date();
  nextWeek.setDate(nextWeek.getDate() + 7);
  const tasks = await prisma.task.findMany({
    where: {
      completed: false,
      dueDate: { lte: nextWeek, not: null },
    },
    include: { tags: { include: { tag: true } }, project: true },
    orderBy: { dueDate: "asc" },
  });
  res.json(tasks);
});
```

Create `client/src/pages/DueSoon.tsx`:

```tsx
import { useEffect, useState } from "react";
import type { Task } from "../lib/types";
import { TaskRow } from "../components/TaskRow";
import { tasks as tasksApi } from "../lib/api";

export function DueSoon() {
  const [taskList, setTaskList] = useState<Task[]>([]);

  const load = async () => {
    const res = await fetch("/api/tasks/due-soon");
    setTaskList(await res.json());
  };

  useEffect(() => { load(); }, []);

  const handleToggle = async (id: string) => {
    await tasksApi.toggleComplete(id);
    load();
  };

  return (
    <div className="p-8 max-w-3xl">
      <h2 className="text-2xl font-bold text-gray-900 mb-6">Due Soon</h2>
      <p className="text-sm text-gray-500 mb-4">Tasks due within the next 7 days</p>
      <div className="space-y-2">
        {taskList.length === 0 ? (
          <p className="text-center py-8 text-gray-400 text-sm">No upcoming deadlines. Nice!</p>
        ) : (
          taskList.map((task) => (
            <TaskRow key={task.id} task={task} onToggleComplete={handleToggle} onSelect={() => {}} />
          ))
        )}
      </div>
    </div>
  );
}
```

**Step 3: Wire into App.tsx**

```tsx
import { AllTasks } from "./pages/AllTasks";
import { DueSoon } from "./pages/DueSoon";
// ...
{view === "all-tasks" && <AllTasks />}
{view === "due-soon" && <DueSoon />}
```

**Step 4: Add tests for new endpoints**

Add to `server/src/__tests__/tasks.test.ts`:

```typescript
describe("GET /api/tasks", () => {
  it("returns all tasks across projects", async () => {
    const p = await prisma.project.create({ data: { name: "P" } });
    await prisma.task.create({ data: { title: "T", projectId: p.id, sortOrder: 0 } });
    const res = await request(app).get("/api/tasks");
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
  });
});

describe("GET /api/tasks/due-soon", () => {
  it("returns tasks due within 7 days", async () => {
    const p = await prisma.project.create({ data: { name: "P" } });
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    await prisma.task.create({
      data: { title: "Soon", projectId: p.id, sortOrder: 0, dueDate: tomorrow },
    });
    const res = await request(app).get("/api/tasks/due-soon");
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
  });
});
```

**Step 5: Run all tests**

Run: `cd server && npx vitest run`
Expected: All tests pass

**Step 6: Commit**

```bash
git add server/ client/
git commit -m "feat: add All Tasks and Due Soon views with API endpoints"
```

---

## Task 14: Final Polish and Verification

**Step 1: Verify all server tests pass**

Run: `cd server && npx vitest run`

**Step 2: Verify full app works end-to-end**

Run: `npm run dev` (from root)
Test these flows:
- Dashboard shows projects
- Create new project via dialog
- Navigate to project, see tasks
- Add task, toggle completion
- Click task to open detail panel
- Edit title, priority, due date, notes
- Toggle tags on/off
- Delete a task
- Check "All Tasks" view
- Check "Due Soon" view
- Sidebar navigation works

**Step 3: Final commit if any fixes needed**

```bash
git add -A
git commit -m "fix: polish and verify end-to-end functionality"
```
