import { type Priority } from "@prisma/client";
import { prisma } from "../db.js";

const VALID_PRIORITIES = ["LOW", "MEDIUM", "HIGH", "URGENT"];
const COLOR_REGEX = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/;

function requireString(args: Record<string, unknown>, key: string, maxLength = 500): string {
  const val = args[key];
  if (typeof val !== "string" || !val.trim()) throw new Error(`${key} is required and must be a non-empty string`);
  if (val.length > maxLength) throw new Error(`${key} must be under ${maxLength} characters`);
  return val.trim();
}

function optionalString(args: Record<string, unknown>, key: string, maxLength = 2000): string | undefined {
  const val = args[key];
  if (val === undefined || val === null) return undefined;
  if (typeof val !== "string") throw new Error(`${key} must be a string`);
  if (val.length > maxLength) throw new Error(`${key} must be under ${maxLength} characters`);
  return val;
}

function validatePriority(val: unknown): Priority | undefined {
  if (val === undefined || val === null) return undefined;
  if (typeof val !== "string" || !VALID_PRIORITIES.includes(val)) {
    throw new Error(`Priority must be one of: ${VALID_PRIORITIES.join(", ")}`);
  }
  return val as Priority;
}

function validateColor(val: unknown): string | undefined {
  if (val === undefined || val === null) return undefined;
  if (typeof val !== "string" || !COLOR_REGEX.test(val)) {
    throw new Error("Color must be a valid hex color (e.g. #FF5733)");
  }
  return val;
}

function validateDueDate(val: unknown): Date | null {
  if (val === undefined || val === null) return null;
  if (typeof val !== "string") throw new Error("dueDate must be a string");
  const d = new Date(val);
  if (isNaN(d.getTime())) throw new Error(`Invalid date: ${val}`);
  return d;
}

function positiveInt(args: Record<string, unknown>, key: string, defaultVal: number): number {
  const val = args[key];
  if (val === undefined || val === null) return defaultVal;
  const n = Number(val);
  if (!Number.isFinite(n) || n < 1) return defaultVal;
  return Math.floor(n);
}

const MAX_BULK_IDS = 50;

function validateTaskIdsArg(args: Record<string, unknown>): string[] {
  const ids = args.taskIds;
  if (!Array.isArray(ids) || ids.length === 0) throw new Error("taskIds must be a non-empty array");
  if (ids.length > MAX_BULK_IDS) throw new Error(`taskIds can contain at most ${MAX_BULK_IDS} items`);
  if (!ids.every(id => typeof id === "string" && id.trim())) throw new Error("Each taskId must be a non-empty string");
  return ids as string[];
}

export async function executeTool(
  name: string,
  args: Record<string, unknown>
): Promise<unknown> {
  switch (name) {
    case "list_projects": {
      return prisma.project.findMany({
        include: { _count: { select: { tasks: true } } },
        orderBy: { createdAt: "desc" },
      });
    }

    case "get_project": {
      return prisma.project.findUnique({
        where: { id: args.projectId as string },
        include: {
          tasks: {
            include: { tags: { include: { tag: true } } },
            orderBy: { sortOrder: "asc" },
          },
        },
      });
    }

    case "create_project": {
      const name = requireString(args, "name", 200);
      const description = optionalString(args, "description", 2000);
      const color = validateColor(args.color);
      return prisma.project.create({ data: { name, description, color } });
    }

    case "update_project": {
      const projectId = requireString(args, "projectId");
      const data: Record<string, unknown> = {};
      if (args.name !== undefined) data.name = requireString(args, "name", 200);
      if (args.description !== undefined) data.description = optionalString(args, "description", 2000);
      if (args.color !== undefined) data.color = validateColor(args.color);
      return prisma.project.update({ where: { id: projectId }, data });
    }

    case "delete_project": {
      const projectId = args.projectId as string;
      await prisma.$transaction([
        prisma.taskTag.deleteMany({
          where: { task: { projectId } },
        }),
        prisma.task.deleteMany({ where: { projectId } }),
        prisma.project.delete({ where: { id: projectId } }),
      ]);
      return { deleted: true };
    }

    case "list_tasks": {
      const where: Record<string, unknown> = {};
      if (args.projectId) where.projectId = args.projectId as string;
      if (args.completed !== undefined) where.completed = args.completed as boolean;
      if (args.priority) where.priority = args.priority as Priority;
      if (args.tagId && typeof args.tagId === "string") {
        where.tags = { some: { tagId: args.tagId as string } };
      }

      // Date range filters
      const dueDateFilter: Record<string, Date> = {};
      if (args.dueBefore) {
        const d = validateDueDate(args.dueBefore);
        if (d) dueDateFilter.lte = d;
      }
      if (args.dueAfter) {
        const d = validateDueDate(args.dueAfter);
        if (d) dueDateFilter.gte = d;
      }
      if (Object.keys(dueDateFilter).length > 0) {
        where.dueDate = dueDateFilter;
      }

      // Sorting
      const VALID_SORT_FIELDS = ["dueDate", "priority", "createdAt", "title"];
      let orderBy: Record<string, string> = { createdAt: "desc" };
      if (args.sortBy && typeof args.sortBy === "string" && VALID_SORT_FIELDS.includes(args.sortBy)) {
        const dir = args.sortOrder === "asc" ? "asc" : "desc";
        orderBy = { [args.sortBy]: dir };
      }

      return prisma.task.findMany({
        where,
        include: { tags: { include: { tag: true } }, project: true },
        orderBy,
      });
    }

    case "create_task": {
      const title = requireString(args, "title", 500);
      const projectId = requireString(args, "projectId");
      const description = optionalString(args, "description", 10000);
      const priority = validatePriority(args.priority) || "MEDIUM";
      const dueDate = validateDueDate(args.dueDate);

      const maxSort = await prisma.task.aggregate({
        where: { projectId },
        _max: { sortOrder: true },
      });
      const sortOrder = (maxSort._max.sortOrder ?? -1) + 1;

      return prisma.task.create({
        data: { title, description, priority, dueDate, sortOrder, projectId },
        include: { tags: { include: { tag: true } } },
      });
    }

    case "update_task": {
      const taskId = requireString(args, "taskId");
      const data: Record<string, unknown> = {};
      if (args.title !== undefined) data.title = requireString(args, "title", 500);
      if (args.description !== undefined) data.description = optionalString(args, "description", 10000);
      if (args.priority !== undefined) data.priority = validatePriority(args.priority);
      if (args.dueDate !== undefined) data.dueDate = validateDueDate(args.dueDate);
      return prisma.task.update({
        where: { id: taskId },
        data,
        include: { tags: { include: { tag: true } } },
      });
    }

    case "complete_task": {
      const existing = await prisma.task.findUnique({
        where: { id: args.taskId as string },
      });
      if (!existing) {
        throw new Error(`Task not found: ${args.taskId}`);
      }
      return prisma.task.update({
        where: { id: args.taskId as string },
        data: {
          completed: !existing.completed,
          completedAt: existing.completed ? null : new Date(),
        },
        include: { tags: { include: { tag: true } } },
      });
    }

    case "delete_task": {
      return prisma.task.delete({
        where: { id: args.taskId as string },
      });
    }

    case "list_tags": {
      return prisma.tag.findMany({ orderBy: { name: "asc" } });
    }

    case "create_tag": {
      const name = requireString(args, "name", 100);
      const color = validateColor(args.color);
      const existing = await prisma.tag.findUnique({ where: { name } });
      if (existing) return existing; // Idempotent: return existing tag
      return prisma.tag.create({ data: { name, color } });
    }

    case "update_tag": {
      const tagId = requireString(args, "tagId");
      const existing = await prisma.tag.findUnique({ where: { id: tagId } });
      if (!existing) throw new Error(`Tag not found: ${tagId}`);
      const data: Record<string, unknown> = {};
      if (args.name !== undefined) {
        const newName = requireString(args, "name", 100);
        if (newName !== existing.name) {
          const duplicate = await prisma.tag.findUnique({ where: { name: newName } });
          if (duplicate) throw new Error(`Tag name already exists: ${newName}`);
        }
        data.name = newName;
      }
      if (args.color !== undefined) data.color = validateColor(args.color);
      return prisma.tag.update({ where: { id: tagId }, data });
    }

    case "add_tag_to_task": {
      const taskId = args.taskId as string;
      const tagId = args.tagId as string;
      const [taskExists, tagExists] = await Promise.all([
        prisma.task.findUnique({ where: { id: taskId }, select: { id: true } }),
        prisma.tag.findUnique({ where: { id: tagId }, select: { id: true } }),
      ]);
      if (!taskExists) throw new Error(`Task not found: ${taskId}`);
      if (!tagExists) throw new Error(`Tag not found: ${tagId}`);
      const existingLink = await prisma.taskTag.findUnique({
        where: { taskId_tagId: { taskId, tagId } },
      });
      if (existingLink) return { alreadyExists: true };
      return prisma.taskTag.create({ data: { taskId, tagId } });
    }

    case "remove_tag_from_task": {
      const taskId = args.taskId as string;
      const tagId = args.tagId as string;
      const link = await prisma.taskTag.findUnique({
        where: { taskId_tagId: { taskId, tagId } },
      });
      if (!link) throw new Error(`Tag ${tagId} is not on task ${taskId}`);
      return prisma.taskTag.delete({
        where: { taskId_tagId: { taskId, tagId } },
      });
    }

    case "get_due_soon": {
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() + positiveInt(args, "days", 7));
      return prisma.task.findMany({
        where: {
          completed: false,
          dueDate: { lte: cutoff, not: null },
        },
        include: { tags: { include: { tag: true } }, project: true },
        orderBy: { dueDate: "asc" },
      });
    }

    case "get_workload_summary": {
      const [total, completed, overdue, byPriority] = await Promise.all([
        prisma.task.count(),
        prisma.task.count({ where: { completed: true } }),
        prisma.task.count({
          where: { completed: false, dueDate: { lt: new Date() } },
        }),
        prisma.task.groupBy({
          by: ["priority"],
          _count: true,
          where: { completed: false },
        }),
      ]);
      return {
        total,
        completed,
        pending: total - completed,
        overdue,
        byPriority,
      };
    }

    case "bulk_complete_tasks": {
      const taskIds = validateTaskIdsArg(args);
      const completed = args.completed as boolean;
      if (typeof completed !== "boolean") throw new Error("completed must be a boolean");
      const result = await prisma.task.updateMany({
        where: { id: { in: taskIds } },
        data: { completed, completedAt: completed ? new Date() : null },
      });
      return { count: result.count };
    }

    case "bulk_delete_tasks": {
      const taskIds = validateTaskIdsArg(args);
      await prisma.$transaction([
        prisma.taskTag.deleteMany({ where: { taskId: { in: taskIds } } }),
        prisma.task.deleteMany({ where: { id: { in: taskIds } } }),
      ]);
      return { count: taskIds.length };
    }

    case "bulk_move_tasks": {
      const taskIds = validateTaskIdsArg(args);
      const projectId = requireString(args, "projectId");
      const project = await prisma.project.findUnique({ where: { id: projectId } });
      if (!project) throw new Error(`Project not found: ${projectId}`);
      const result = await prisma.task.updateMany({
        where: { id: { in: taskIds } },
        data: { projectId },
      });
      return { count: result.count };
    }

    default:
      throw new Error(`Unknown tool: ${name}`);
  }
}
