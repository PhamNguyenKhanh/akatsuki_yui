import { expect, type Page } from "@playwright/test";

export function makeRunTag(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

export async function uiLogin(page: Page, email: string, password: string): Promise<void> {
  await page.goto("/login");
  await page.locator("#email").fill(email);
  await page.locator("#password").fill(password);
  await page.getByRole("button", { name: "Đăng nhập" }).click();
  await page.waitForURL(/\/dashboard/, { timeout: 15_000 });
}

export async function assertNoHorizontalOverflow(page: Page, viewportName: string): Promise<void> {
  const dimensions = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    innerWidth: window.innerWidth,
  }));
  expect(
    dimensions.scrollWidth,
    `Horizontal overflow detected on ${page.url()} at ${viewportName}`
  ).toBeLessThanOrEqual(dimensions.innerWidth + 1);
}
