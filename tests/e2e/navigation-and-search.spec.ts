import { expect, test } from "@playwright/test";

async function setup(page: import("@playwright/test").Page) {
  const suffix = Date.now();
  const registration = await page.request.post("/api/auth/register", {
    headers: { "x-forwarded-for": "127.0.2.10" },
    data: {
      name: "Shell Navigator",
      email: `shell-${suffix}@example.test`,
      password: "a secure browser password",
    },
  });
  const registrationBody = await registration.json();
  expect(registration.status(), JSON.stringify(registrationBody)).toBe(201);
  const user = registrationBody.data.user;
  const organization = (
    await (
      await page.request.post("/api/organizations", {
        data: { name: `Navigation ${suffix}` },
      })
    ).json()
  ).data.organization;
  const project = (
    await (
      await page.request.post("/api/projects", {
        data: {
          organizationId: organization.id,
          name: `Orion Launch ${suffix}`,
          description: "Searchable navigation project",
          ownerId: user.id,
          status: "ACTIVE",
        },
      })
    ).json()
  ).data.project;
  const task = (
    await (
      await page.request.post("/api/tasks", {
        data: {
          projectId: project.id,
          title: `Calibrate beacon ${suffix}`,
          description: "Unique global search target",
          priority: "HIGH",
        },
      })
    ).json()
  ).data.task;
  return { suffix, project, task };
}

test("global search supports slash, empty results, arrows, enter, and escape", async ({
  page,
}) => {
  const { suffix, task } = await setup(page);
  await page.goto("/dashboard");
  await page.getByRole("button", { name: "Search WorkSphere" }).click();
  await expect(
    page.getByRole("dialog", { name: "Search WorkSphere" }),
  ).toBeVisible();
  await expect(page.getByLabel("Search query")).toBeFocused();
  await page.getByLabel("Search query").fill(`nothing-${suffix}`);
  await expect(page.getByText(new RegExp(`No work matches`))).toBeVisible();
  await page.getByLabel("Search query").fill(`Calibrate beacon ${suffix}`);
  await expect(page.getByText(task.title, { exact: true })).toBeVisible();
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("ArrowUp");
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(new RegExp(`/tasks/${task.id}$`));
  await page.keyboard.press("/");
  await expect(
    page.getByRole("dialog", { name: "Search WorkSphere" }),
  ).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(
    page.getByRole("dialog", { name: "Search WorkSphere" }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Search WorkSphere" }),
  ).toBeFocused();
});

test("shell destinations and active sidebar states are connected", async ({
  page,
}) => {
  await setup(page);
  await page.goto("/dashboard#projects");
  await expect(
    page.getByRole("link", { name: "Projects", exact: true }),
  ).toHaveClass(/active/);
  await page.getByRole("link", { name: "Notifications" }).click();
  await expect(
    page.getByRole("heading", { name: "Notifications", exact: true }),
  ).toBeVisible();
  await page.getByRole("link", { name: "Help" }).click();
  await expect(
    page.getByRole("heading", { name: "Keep work moving." }),
  ).toBeVisible();
  await page.getByRole("link", { name: "Settings", exact: true }).click();
  await expect(
    page.getByRole("link", { name: "Settings", exact: true }),
  ).toHaveClass(/active/);
});

test("mobile navigation keeps workspace management destinations available", async ({
  page,
}) => {
  await setup(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/dashboard");
  const navigation = page.getByRole("navigation", {
    name: "Workspace navigation",
  });
  await expect(
    navigation.getByRole("link", { name: "Your work" }),
  ).toBeVisible();
  for (const name of [
    "Projects",
    "Reports",
    "Activity",
    "Teams",
    "People",
    "Settings",
  ]) {
    const link = page.getByRole("link", { name, exact: true });
    await link.scrollIntoViewIfNeeded();
    await expect(link).toBeVisible();
  }
});
