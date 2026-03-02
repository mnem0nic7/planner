import { prisma } from "../db.js";
import { beforeEach, afterAll } from "vitest";

beforeEach(async () => {
  // Use transaction to ensure all deletes complete atomically
  await prisma.$transaction([
    prisma.message.deleteMany(),
    prisma.conversation.deleteMany(),
    prisma.taskTag.deleteMany(),
    prisma.task.deleteMany(),
    prisma.tag.deleteMany(),
    prisma.project.deleteMany(),
  ]);
});

afterAll(async () => {
  await prisma.$disconnect();
});
