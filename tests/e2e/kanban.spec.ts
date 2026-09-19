import { test, expect } from "@playwright/test";

test("board supports persistent dragging, keyboard moves, rollback, and responsive layouts", async ({
  page,
  browser,
}, testInfo) => {
  test.setTimeout(100_000);
  await page.goto("/register");
  await page.getByLabel("Name", { exact: true }).fill("Board Tester");
  await page
    .getByLabel("Email", { exact: true })
    .fill(`kanban-${Date.now()}@example.test`);
  await page
    .getByLabel("Password", { exact: true })
    .fill("a secure browser password");
  await page.getByRole("button", { name: /create account/i }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
  const organizationResponse = await page.request.post("/api/organizations", {
    data: { name: `Kanban ${Date.now()}` },
  });
  expect(organizationResponse.status()).toBe(201);
  const organization = (await organizationResponse.json()).data.organization;
  try {
    const projectResponse = await page.request.post("/api/projects", {
      data: { organizationId: organization.id, name: "Release workspace" },
    });
    expect(projectResponse.status()).toBe(201);
    const project = (await projectResponse.json()).data.project;
    const taskIds: string[] = [];
    for (const [title, priority] of [
      ["Review launch checklist", "HIGH"],
      ["Verify tenant boundaries", "URGENT"],
      ["Publish release notes", "LOW"],
    ]) {
      const response = await page.request.post("/api/tasks", {
        data: {
          projectId: project.id,
          title,
          priority,
          dueDate: "2026-09-30T00:00:00.000Z",
        },
      });
      expect(response.status()).toBe(201);
      taskIds.push((await response.json()).data.task.id);
    }
    const endpoint = `/api/projects/${project.id}/board`;
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto(`/projects/${project.id}`);
    const column = (status: string) =>
      page.locator(`[data-column="${status}"]`);
    const card = (id: string) => page.locator(`[data-task-id="${id}"]`);
    await expect(column("TODO").locator("article")).toHaveCount(3);
    await page.waitForTimeout(750);

    // Pointer drag into an empty column exercises the droppable column itself.
    const handle = page.getByRole("button", {
      name: "Move Review launch checklist",
      exact: true,
    });
    await expect(handle).toBeVisible();
    await expect(column("IN_PROGRESS")).toBeVisible();
    const start = await handle.boundingBox();
    const end = await column("IN_PROGRESS").boundingBox();
    if (!start || !end) throw new Error("Board drag targets must be visible");
    await page.mouse.move(
      start.x + start.width / 2,
      start.y + start.height / 2,
    );
    await page.mouse.down();
    await page.mouse.move(start.x + 32, start.y + 32, { steps: 8 });
    await expect(page.locator(".kanban-drag-overlay")).toBeVisible();
    await expect(card(taskIds[0]!)).toHaveClass(/is-dragging/);
    await page.mouse.move(end.x + end.width / 2, end.y + 50, { steps: 15 });
    await expect(page.locator(".column-in_progress")).toHaveClass(
      /drag-target/,
    );
    await expect(
      page.locator(".column-in_progress .kanban-drop-indicator"),
    ).toContainText("Drop in In progress");
    await page.mouse.up();
    await expect(
      column("IN_PROGRESS").getByRole("link", {
        name: "Review launch checklist",
      }),
    ).toBeVisible();
    await expect(
      page.getByRole("status").filter({ hasText: "Task moved" }),
    ).toBeVisible();
    await page.reload();
    await expect(
      column("IN_PROGRESS").getByRole("link", {
        name: "Review launch checklist",
      }),
    ).toBeVisible();

    // Keyboard sorting uses dnd-kit's keyboard sensor and the focused handle.
    const keyboardHandle = page.getByRole("button", {
      name: "Move Verify tenant boundaries",
      exact: true,
    });
    await keyboardHandle.focus();
    await page.keyboard.press("Space");
    await page.keyboard.press("ArrowDown");
    await page.keyboard.press("Space");
    await expect(column("TODO").locator("article").first()).toHaveAttribute(
      "data-task-id",
      taskIds[2]!,
    );
    await expect(
      page.getByRole("status").filter({ hasText: "Task moved" }),
    ).toBeVisible();

    let releaseFailure!: () => void;
    const failureGate = new Promise<void>((resolve) => {
      releaseFailure = resolve;
    });
    await page.route(`**${endpoint}`, async (route) => {
      if (route.request().method() === "PATCH") {
        await failureGate;
        await route.fulfill({
          status: 500,
          contentType: "application/json",
          body: JSON.stringify({ error: { message: "Unavailable" } }),
        });
      } else await route.continue();
    });
    await page
      .getByLabel("Status for Review launch checklist")
      .selectOption("DONE");
    await expect(
      column("DONE").getByRole("link", { name: "Review launch checklist" }),
    ).toBeVisible();
    releaseFailure();
    await expect(page.locator(".board-error")).toContainText(
      "could not be saved",
    );
    await expect(
      column("IN_PROGRESS").getByRole("link", {
        name: "Review launch checklist",
      }),
    ).toBeVisible();
    await expect(
      page.getByLabel("Status for Review launch checklist"),
    ).toBeEnabled();
    await page.unroute(`**${endpoint}`);

    // Another client writes after this page loaded; the optimistic move must fail.
    const update = await page.request.patch(`/api/tasks/${taskIds[0]}`, {
      data: { priority: "URGENT" },
    });
    expect(update.ok()).toBeTruthy();
    await page
      .getByLabel("Status for Review launch checklist")
      .selectOption("DONE");
    await expect(page.locator(".board-error")).toContainText("another session");
    await expect(
      page.getByLabel("Status for Review launch checklist"),
    ).toBeEnabled();
    await expect(
      column("IN_PROGRESS").getByRole("link", {
        name: "Review launch checklist",
      }),
    ).toBeVisible();
    await page
      .getByLabel("Status for Review launch checklist")
      .selectOption("DONE");
    await expect(
      column("DONE").getByRole("link", { name: "Review launch checklist" }),
    ).toBeVisible();
    await expect(
      page.getByLabel("Status for Review launch checklist"),
    ).toBeEnabled();

    await page.getByRole("button", { name: "New Task" }).click();
    await page
      .getByLabel("Title", { exact: true })
      .fill("Confirm release readiness");
    await page.getByRole("button", { name: "Create Task" }).click();
    await expect(
      column("TODO").getByRole("link", { name: "Confirm release readiness" }),
    ).toBeVisible();
    await page.screenshot({
      path: testInfo.outputPath("kanban-desktop.png"),
      fullPage: true,
    });
    await page.setViewportSize({ width: 390, height: 844 });
    await expect(card(taskIds[0]!)).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBeTruthy();
    await page.screenshot({
      path: testInfo.outputPath("kanban-mobile.png"),
      fullPage: true,
    });
    const readonly = await browser.newContext({
      baseURL: new URL(page.url()).origin,
    });
    try {
      expect((await readonly.request.get(endpoint)).status()).toBe(401);
      const email = `kanban-viewer-${Date.now()}@example.test`;
      const registerViewer = () =>
        readonly.request.post("/api/auth/register", {
          data: {
            name: "Board Viewer",
            email,
            password: "a secure browser password",
          },
        });
      let registration = await registerViewer();
      // The full suite creates more accounts than one registration window allows.
      if (registration.status() === 429) {
        const retrySeconds = Number(registration.headers()["retry-after"]);
        expect(retrySeconds).toBeGreaterThan(0);
        expect(retrySeconds).toBeLessThanOrEqual(60);
        await new Promise((resolve) =>
          setTimeout(resolve, retrySeconds * 1000),
        );
        registration = await registerViewer();
      }
      expect(registration.status()).toBe(201);
      expect((await readonly.request.get(endpoint)).status()).toBe(404);
      const invitation = await page.request.post("/api/invitations", {
        data: { organizationId: organization.id, email, role: "VIEWER" },
      });
      expect(invitation.status()).toBe(201);
      const token = (await invitation.json()).data.invitation.token;
      expect(
        (
          await readonly.request.post("/api/invitations/accept", {
            data: { token },
          })
        ).ok(),
      ).toBeTruthy();
      const snapshot = (await (await readonly.request.get(endpoint)).json())
        .data.board;
      expect(
        (
          await readonly.request.patch(endpoint, {
            data: {
              taskId: taskIds[0],
              status: "TODO",
              index: 0,
              revision: snapshot.revision,
            },
          })
        ).status(),
      ).toBe(403);
      expect(
        (
          await page.request.patch(endpoint, {
            data: {
              taskId: taskIds[0],
              status: "TODO",
              index: -1,
              revision: snapshot.revision,
            },
          })
        ).status(),
      ).toBe(400);
      const viewerPage = await readonly.newPage();
      await viewerPage.goto(`/projects/${project.id}`);
      await expect(
        viewerPage.getByText("Read only", { exact: true }),
      ).toBeVisible();
      await expect(
        viewerPage.getByRole("button", { name: "New Task" }),
      ).toHaveCount(0);
      await expect(
        viewerPage.getByLabel("Status for Review launch checklist"),
      ).toHaveCount(0);
      await expect(
        viewerPage.getByRole("button", {
          name: "Move Review launch checklist",
          exact: true,
        }),
      ).toHaveCount(0);
    } finally {
      await readonly.close();
    }
    await card(taskIds[0]!).getByRole("link").click();
    await expect(
      page.getByRole("heading", { name: "Review launch checklist" }),
    ).toBeVisible();
  } finally {
    const response = await page.request.delete(
      `/api/organizations/${organization.id}`,
    );
    expect(response.status()).toBe(204);
  }
});
