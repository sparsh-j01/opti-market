import { test, expect } from "@playwright/test";

/**
 * User-flow E2E (plan §7): open the dashboard, wait through the boot overlay,
 * click Optimize, assert results render and no console errors.
 */

test("dashboard loads, boots engine, optimizes, renders results", async ({
  page,
}) => {
  const consoleErrors: string[] = [];
  page.on("console", (m) => {
    if (m.type() === "error") consoleErrors.push(m.text());
  });

  await page.goto("/dashboard");

  // The boot overlay must appear (not an opaque freeze) then resolve.
  await expect(page.getByRole("status")).toBeVisible();
  await page.waitForFunction(
    () =>
      (window as unknown as { __optimarket?: { getBootStatus: () => { phase: string } } })
        .__optimarket?.getBootStatus().phase === "ready",
    null,
    { timeout: 150_000 },
  );

  // Run an optimization via the UI.
  await page.getByRole("button", { name: /optimize/i }).first().click();

  // Results modal / metrics should populate.
  await expect(page.getByText(/Portfolio Yield|Sharpe/i).first()).toBeVisible({
    timeout: 60_000,
  });

  expect(
    consoleErrors.filter((e) => !/favicon|analytics/i.test(e)),
    consoleErrors.join("\n"),
  ).toEqual([]);
});

test("data as of label is shown", async ({ page }) => {
  await page.goto("/dashboard");
  await expect(page.getByText(/Data as of \d{4}-\d{2}-\d{2}/)).toBeVisible({
    timeout: 30_000,
  });
});
