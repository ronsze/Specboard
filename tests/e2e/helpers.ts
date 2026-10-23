import type { Page } from "@playwright/test";

export const PASSWORD = "specboard123";

export async function login(page: Page, who: "admin" | "member" | "viewer") {
  await page.goto("/login");
  await page.getByLabel("이메일").fill(`${who}@specboard.local`);
  await page.getByLabel("비밀번호").fill(PASSWORD);
  await page.getByRole("button", { name: "로그인" }).click();
  await page.waitForURL("/");
}

export async function openFeature(page: Page) {
  await page.getByRole("link", { name: "입력 제출과 승인" }).click();
  await page.waitForURL(/\/inputs$/);
}

/** 실행마다 새 feature를 만들어 다른 시나리오가 남긴 데이터와 섞이지 않게 한다. */
export async function createFeature(name: string) {
  const { config } = await import("dotenv");
  config({ path: ".env", quiet: true });
  const { PrismaClient } = await import("@prisma/client");
  const db = new PrismaClient();
  try {
    const project = await db.project.findFirstOrThrow({ where: { board: { name: "Specboard 팀" } } });
    await db.feature.create({ data: { projectId: project.id, name } });
  } finally {
    await db.$disconnect();
  }
}

export async function openFeatureByName(page: Page, name: string) {
  await page.getByRole("link", { name }).click();
  await page.waitForURL(/\/inputs$/);
}
