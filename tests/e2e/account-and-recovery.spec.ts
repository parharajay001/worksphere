import { expect, test } from "@playwright/test";

async function register(
  page: import("@playwright/test").Page,
  email: string,
  name = "Account Tester",
) {
  const response = await page.request.post("/api/auth/register", {
    headers: {
      "x-forwarded-for": `127.0.1.${Math.floor(Math.random() * 200) + 1}`,
    },
    data: { name, email, password: "a secure browser password" },
  });
  expect(response.status()).toBe(201);
}

test("forgot and reset password handles confirmation, used, and invalid tokens", async ({
  page,
}) => {
  const email = `recovery-${Date.now()}@example.test`;
  await register(page, email);
  await page.goto("/forgot-password");
  await page.getByLabel("Email address").fill(email);
  await page.getByRole("button", { name: "Send reset link" }).click();
  await expect(
    page.getByRole("heading", { name: "Check your inbox" }),
  ).toBeVisible();
  const resetResponse = await page.request.post(
    "/api/auth/password-reset/request",
    {
      headers: { "x-forwarded-for": "127.0.1.219" },
      data: { email },
    },
  );
  const token = (await resetResponse.json()).data.previewToken as string;

  await page.goto(`/reset-password?token=${token}`);
  await page
    .getByLabel("New password", { exact: true })
    .fill("a newer secure password");
  await page.getByLabel("Confirm new password").fill("different password");
  await page.getByRole("button", { name: "Reset password" }).click();
  await expect(page.getByText("Passwords do not match.")).toBeVisible();
  await expect(page.getByLabel("Confirm new password")).toBeFocused();
  await page.getByLabel("Confirm new password").fill("a newer secure password");
  await page.getByRole("button", { name: "Reset password" }).click();
  await expect(
    page.getByRole("heading", { name: "Password updated" }),
  ).toBeVisible();

  await page.goto(`/reset-password?token=${token}`);
  await page
    .getByLabel("New password", { exact: true })
    .fill("another secure password");
  await page.getByLabel("Confirm new password").fill("another secure password");
  await page.getByRole("button", { name: "Reset password" }).click();
  await expect(
    page.getByText(/expired or has already been used/i),
  ).toBeVisible();

  await page.goto(`/reset-password?token=${"x".repeat(43)}`);
  await page
    .getByLabel("New password", { exact: true })
    .fill("another secure password");
  await page.getByLabel("Confirm new password").fill("another secure password");
  await page.getByRole("button", { name: "Reset password" }).click();
  await expect(
    page.getByText(/expired or has already been used/i),
  ).toBeVisible();
});

test("email verification reports success and rejects a consumed token", async ({
  page,
}) => {
  const email = `verification-${Date.now()}@example.test`;
  await register(page, email);
  const resend = await page.request.post("/api/auth/verify-email/resend", {
    headers: { "x-forwarded-for": "127.0.1.220" },
  });
  expect(resend.ok()).toBe(true);
  const token = (await resend.json()).data.previewToken as string;
  await page.goto(`/verify-email?token=${token}`);
  await expect(
    page.getByRole("heading", { name: "Email verified" }),
  ).toBeVisible();
  await page.goto(`/verify-email?token=${token}`);
  await expect(
    page.getByText(/expired or has already been used/i),
  ).toBeVisible();
});

test("account settings update the profile and password through the profile menu", async ({
  page,
}) => {
  const suffix = Date.now();
  const email = `account-${suffix}@example.test`;
  await register(page, email, "Original Name");
  await page.goto("/dashboard");
  await page.getByRole("button", { name: "Open profile menu" }).click();
  await expect(page.getByRole("menu")).toBeVisible();
  await page.getByRole("menuitem", { name: "Account settings" }).click();
  await page.getByLabel("Display name").fill("Updated Name");
  await page.getByRole("button", { name: "Save profile" }).click();
  await expect(page.getByText("Profile name updated.")).toBeVisible();

  await page.getByLabel("Current password").fill("a secure browser password");
  await page
    .getByLabel("New password", { exact: true })
    .fill("a changed browser password");
  await page
    .getByLabel("Confirm new password")
    .fill("a changed browser password");
  await page.getByRole("button", { name: "Update password" }).click();
  await expect(page.getByText("Password updated.")).toBeVisible();
  await page.getByRole("button", { name: "Open profile menu" }).click();
  await page.getByRole("menuitem", { name: "Sign out" }).click();
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill("a changed browser password");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(
    page.getByRole("heading", { name: /good morning, updated/i }),
  ).toBeVisible();
});
