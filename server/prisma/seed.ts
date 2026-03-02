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
