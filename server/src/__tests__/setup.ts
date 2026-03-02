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
