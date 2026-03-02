import { type Priority } from "@prisma/client";
import { prisma } from "../db.js";

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
      return prisma.project.create({
        data: {
          name: args.name as string,
          description: args.description as string | undefined,
          color: args.color as string | undefined,
        },
      });
    }

    case "update_project": {
      return prisma.project.update({
        where: { id: args.projectId as string },
        data: {
          ...(args.name !== undefined && { name: args.name as string }),
          ...(args.description !== undefined && {
            description: args.description as string,
          }),
          ...(args.color !== undefined && { color: args.color as string }),
        },
      });
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
      return prisma.task.findMany({
        where,
        include: { tags: { include: { tag: true } }, project: true },
        orderBy: { createdAt: "desc" },
      });
    }

    case "create_task": {
      const maxSort = await prisma.task.aggregate({
        where: { projectId: args.projectId as string },
        _max: { sortOrder: true },
      });
      const sortOrder = (maxSort._max.sortOrder ?? -1) + 1;

      return prisma.task.create({
        data: {
          title: args.title as string,
          description: args.description as string | undefined,
          priority: (args.priority as Priority) || "MEDIUM",
          dueDate: args.dueDate ? new Date(args.dueDate as string) : null,
          sortOrder,
          projectId: args.projectId as string,
        },
        include: { tags: { include: { tag: true } } },
      });
    }

    case "update_task": {
      const data: Record<string, unknown> = {};
      if (args.title !== undefined) data.title = args.title as string;
      if (args.description !== undefined) data.description = args.description as string;
      if (args.priority !== undefined) data.priority = args.priority as Priority;
      if (args.dueDate !== undefined) data.dueDate = args.dueDate ? new Date(args.dueDate as string) : null;
      return prisma.task.update({
        where: { id: args.taskId as string },
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
      return prisma.tag.create({
        data: {
          name: args.name as string,
          color: args.color as string | undefined,
        },
      });
    }

    case "add_tag_to_task": {
      return prisma.taskTag.create({
        data: {
          taskId: args.taskId as string,
          tagId: args.tagId as string,
        },
      });
    }

    case "remove_tag_from_task": {
      return prisma.taskTag.delete({
        where: {
          taskId_tagId: {
            taskId: args.taskId as string,
            tagId: args.tagId as string,
          },
        },
      });
    }

    case "get_due_soon": {
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() + ((args.days as number) || 7));
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

    default:
      throw new Error(`Unknown tool: ${name}`);
  }
}
