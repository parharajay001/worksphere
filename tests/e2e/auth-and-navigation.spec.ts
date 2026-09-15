import { test, expect } from "@playwright/test";

test("anonymous users are redirected from the dashboard", async ({ page }) => {
  await page.goto("/dashboard");
  await expect(page).toHaveURL(/\/login$/);
  await expect(
    page.getByRole("heading", { name: /good to see you again/i }),
  ).toBeVisible();
});

test("registration creates a session and logout protects the dashboard", async ({
  page,
}) => {
  const email = `e2e-${Date.now()}@example.test`;
  await page.goto("/register");
  await page.getByLabel("Name").fill("Browser Tester");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill("a secure browser password");
  await page.getByRole("button", { name: /create account/i }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(
    page.getByRole("heading", { name: /welcome, browser tester/i }),
  ).toBeVisible();
  await page.getByRole("button", { name: /sign out/i }).click();
  await expect(page).toHaveURL(/\/login$/);
});

test("invalid login shows a generic error without navigation", async ({
  page,
}) => {
  await page.goto("/login");
  await page.getByLabel("Email").fill("missing@example.test");
  await page.getByLabel("Password").fill("a secure browser password");
  await page.getByRole("button", { name: /sign in/i }).click();
  await expect(page.locator(".auth-error")).toContainText(
    "Authentication is required",
  );
  await expect(page).toHaveURL(/\/login$/);
});
