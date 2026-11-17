import { expect, test } from "@playwright/test";

test.describe("UI Theme Switcher — Light/Dark Modes & 5 Color Palettes", () => {
  test("switches light/dark modes and green/blue/purple/pink/gray themes with localStorage persistence", async ({
    page,
  }) => {
    const consoleErrors: string[] = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") {
        consoleErrors.push(msg.text());
      }
    });
    page.on("pageerror", (err) => {
      consoleErrors.push(err.message);
    });

    await page.goto("/");

    const html = page.locator("html");
    await expect(html).toHaveAttribute("data-mode", "light");
    await expect(html).toHaveAttribute("data-theme", "gray");

    await page.getByTestId("theme-switcher-trigger").click();
    await expect(page.getByTestId("theme-switcher-popover")).toBeVisible();

    await page.getByTestId("theme-mode-dark").click();
    await expect(html).toHaveAttribute("data-mode", "dark");
    await expect(html).toHaveClass(/\bdark\b/);

    for (const color of ["green", "blue", "purple", "pink", "gray"] as const) {
      await page.getByTestId(`theme-color-${color}`).click();
      await expect(html).toHaveAttribute("data-theme", color);
    }

    await page.getByTestId("theme-color-purple").click();
    await page.goto("/login");
    await expect(html).toHaveAttribute("data-mode", "dark");
    await expect(html).toHaveAttribute("data-theme", "purple");

    await page.reload();
    await expect(html).toHaveAttribute("data-mode", "dark");
    await expect(html).toHaveAttribute("data-theme", "purple");

    await page.getByTestId("theme-switcher-trigger").click();
    await page.getByTestId("theme-mode-light").click();
    await page.getByTestId("theme-color-green").click();
    await expect(html).toHaveAttribute("data-mode", "light");
    await expect(html).toHaveAttribute("data-theme", "green");

    expect(consoleErrors).toEqual([]);
  });
});
