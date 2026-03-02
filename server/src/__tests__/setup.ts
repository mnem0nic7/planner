import { prisma } from "../db.js";
import { beforeEach, afterAll } from "vitest";

beforeEach(async () => {
  await prisma.$transaction(async (tx) => {
    await tx.message.deleteMany();
    await tx.conversation.deleteMany();
    await tx.taskTag.deleteMany();
    await tx.task.deleteMany();
    await tx.tag.deleteMany();
    await tx.project.deleteMany();
  });
});

afterAll(async () => {
  await prisma.$disconnect();
});
