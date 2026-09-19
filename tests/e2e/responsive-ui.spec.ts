import { expect, test, type Page } from "@playwright/test";

const viewports = [
  { name: "mobile", width: 360, height: 800 },
  { name: "tablet", width: 768, height: 1024 },
  { name: "desktop", width: 1280, height: 900 },
  { name: "wide", width: 1600, height: 1000 },
] as const;

async function expectNoPageOverflow(page: Page) {
  const dimensions = await page.evaluate(() => ({
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
  }));
  expect(
    dimensions.scrollWidth,
    `page width ${dimensions.scrollWidth}px exceeds viewport ${dimensions.clientWidth}px`,
  ).toBeLessThanOrEqual(dimensions.clientWidth + 1);
}

for (const viewport of viewports) {
  test(`${viewport.name} public and authenticated shells do not overflow`, async ({
    page,
  }) => {
    test.setTimeout(90_000);
    await page.setViewportSize(viewport);
    for (const route of [
      "/",
      "/login",
      "/register",
      "/forgot-password",
      "/reset-password",
      "/verify-email",
      "/invitations/accept",
    ]) {
      await page.goto(route);
      await expectNoPageOverflow(page);
    }

    const suffix = Date.now();
    const email = `responsive-${viewport.name}-${suffix}@example.test`;
    await page.goto("/register");
    await page.getByLabel("Name").fill("Responsive Tester");
    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Password").fill("a secure browser password");
    await page.getByRole("button", { name: /create account/i }).click();
    await expect(page).toHaveURL(/\/dashboard$/);

    const organizationResponse = await page.request.post("/api/organizations", {
      data: { name: `Responsive ${viewport.name} workspace ${suffix}` },
    });
    expect(organizationResponse.ok()).toBeTruthy();
    const organization = (await organizationResponse.json()).data.organization;
    const teamResponse = await page.request.post("/api/teams", {
      data: {
        organizationId: organization.id,
        name: `Responsive Team ${suffix}`,
      },
    });
    expect(teamResponse.ok()).toBeTruthy();
    const team = (await teamResponse.json()).data.team;
    const projectResponse = await page.request.post("/api/projects", {
      data: {
        organizationId: organization.id,
        teamId: team.id,
        name: `Responsive Project With A Long Name ${suffix}`,
        description: "Layout fixture for responsive browser coverage.",
      },
    });
    expect(projectResponse.ok()).toBeTruthy();
    const project = (await projectResponse.json()).data.project;
    const taskResponse = await page.request.post("/api/tasks", {
      data: {
        projectId: project.id,
        title: "Verify every responsive layout at supported viewport widths",
        priority: "HIGH",
      },
    });
    expect(taskResponse.ok()).toBeTruthy();
    const task = (await taskResponse.json()).data.task;

    const authenticatedRoutes = [
      "/dashboard",
      "/projects",
      "/projects/new",
      `/projects/${project.id}`,
      `/projects/${project.id}/settings`,
      `/tasks/${task.id}`,
      "/analytics",
      "/activity",
      "/teams",
      `/teams/${team.id}`,
      "/people",
      "/notifications",
      "/settings/account",
      "/settings/workspace",
      "/settings/billing",
      "/settings/audit",
      "/help",
    ];
    for (const route of authenticatedRoutes) {
      await page.goto(route);
      await expectNoPageOverflow(page);
    }

    if (viewport.name === "mobile") {
      await page.getByRole("button", { name: "Open navigation" }).click();
      const mobileDestinations = [
        "Your work",
        "Projects",
        "Reports",
        "Activity",
        "Teams",
        "People",
        "Settings",
        "Audit log",
      ];
      for (const destination of mobileDestinations)
        await expect(
          page.getByRole("link", { name: destination, exact: true }),
        ).toBeVisible();
      await page
        .getByRole("button", { name: "Close navigation" })
        .last()
        .click();
    }
  });
}
