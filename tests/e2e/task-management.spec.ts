import { expect, test, type APIRequestContext } from "@playwright/test";

async function register(
  request: APIRequestContext,
  input: { name: string; email: string; password: string },
) {
  let response = await request.post("/api/auth/register", { data: input });
  if (response.status() === 429) {
    const seconds = Number(response.headers()["retry-after"] ?? 1);
    await new Promise((resolve) => setTimeout(resolve, seconds * 1_000));
    response = await request.post("/api/auth/register", { data: input });
  }
  expect(response.status()).toBe(201);
}

test("task managers can create, filter, edit every field, and delete a task", async ({
  page,
}) => {
  test.setTimeout(90_000);
  const suffix = Date.now();
  const email = `task-manager-${suffix}@example.test`;
  const password = "a secure browser password";
  await register(page.request, { name: "Task Manager", email, password });
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
  const organizationResponse = await page.request.post("/api/organizations", {
    data: { name: `Task Studio ${suffix}` },
  });
  const organization = (await organizationResponse.json()).data.organization;
  const projectResponse = await page.request.post("/api/projects", {
    data: { organizationId: organization.id, name: `Task Project ${suffix}` },
  });
  const project = (await projectResponse.json()).data.project;

  await page.goto(`/projects/${project.id}`);
  await page.getByRole("button", { name: "New Task" }).click();
  const dialog = page.getByRole("dialog", { name: "Create a task" });
  await dialog
    .getByLabel("Title", { exact: true })
    .fill(`Release task ${suffix}`);
  await dialog.getByLabel(/Description/).fill("Initial task description");
  await dialog
    .getByRole("combobox", { name: "Status" })
    .selectOption("IN_PROGRESS");
  await dialog.getByRole("combobox", { name: "Priority" }).selectOption("HIGH");
  await dialog
    .getByRole("combobox", { name: "Assignee" })
    .selectOption({ label: "Task Manager" });
  await dialog.getByLabel("Due date", { exact: true }).fill("2026-10-01");
  await dialog.getByRole("button", { name: "Create Task" }).click();
  await expect(
    page.getByRole("link", { name: `Release task ${suffix}` }),
  ).toBeVisible();

  await page.getByPlaceholder("Search tasks…").fill("Release task");
  await expect(page).toHaveURL(/q=Release(\+|%20)task/);
  await page.getByLabel("Filter by status").selectOption("IN_PROGRESS");
  await page.getByLabel("Filter by priority").selectOption("HIGH");
  await page
    .getByLabel("Filter by assignee")
    .selectOption({ label: "Task Manager" });
  await page.getByLabel("Filter by due date").selectOption("next7");
  await expect(page.getByText("No matching tasks")).toBeVisible();
  await page.getByRole("button", { name: "Clear Filters" }).click();
  await expect(page).not.toHaveURL(/q=|status=|priority=|assignee=|due=/);

  await page.getByRole("link", { name: `Release task ${suffix}` }).click();
  await expect(page.getByText("Reporter")).toBeVisible();
  await expect(page.getByText("Created")).toBeVisible();
  await expect(page.getByText("Updated")).toBeVisible();
  await page.getByRole("button", { name: "Edit Task" }).click();
  await page
    .getByLabel("Title", { exact: true })
    .fill(`Release task updated ${suffix}`);
  await page.getByLabel(/Description/).fill("Updated acceptance criteria");
  await page.getByRole("combobox", { name: "Status" }).selectOption("REVIEW");
  await page.getByRole("combobox", { name: "Priority" }).selectOption("URGENT");
  await page.getByRole("combobox", { name: "Assignee" }).selectOption("");
  await page.getByLabel("Due date", { exact: true }).fill("2026-10-15");
  await page.getByRole("button", { name: "Save Task" }).click();
  await expect(page.getByText("Task details saved.")).toBeVisible();
  await expect(
    page.getByRole("heading", { name: `Release task updated ${suffix}` }),
  ).toBeVisible();
  await expect(page.getByText("Updated acceptance criteria")).toBeVisible();
  await expect(page.getByText("urgent", { exact: true })).toBeVisible();
  await expect(page.getByText("Unassigned", { exact: true })).toBeVisible();

  await page
    .getByLabel(new RegExp(`Type Release task updated ${suffix}`))
    .fill(`Release task updated ${suffix}`);
  await page.getByRole("button", { name: "Delete Task" }).click();
  await expect(page).toHaveURL(new RegExp(`/projects/${project.id}$`));
  await expect(page.getByText(`Release task updated ${suffix}`)).toHaveCount(0);
});

test("read-only members cannot edit or delete task details", async ({
  page,
  playwright,
}) => {
  test.setTimeout(90_000);
  const suffix = Date.now();
  const password = "a secure browser password";
  const owner = await playwright.request.newContext({
    baseURL: "http://localhost:3000",
  });
  try {
    await register(owner, {
      name: "Task Owner",
      email: `task-owner-${suffix}@example.test`,
      password,
    });
    const organization = (
      await (
        await owner.post("/api/organizations", {
          data: { name: `Viewer Studio ${suffix}` },
        })
      ).json()
    ).data.organization;
    const project = (
      await (
        await owner.post("/api/projects", {
          data: {
            organizationId: organization.id,
            name: `Viewer Project ${suffix}`,
          },
        })
      ).json()
    ).data.project;
    const task = (
      await (
        await owner.post("/api/tasks", {
          data: { projectId: project.id, title: `Read only task ${suffix}` },
        })
      ).json()
    ).data.task;

    const viewerEmail = `task-viewer-${suffix}@example.test`;
    await register(page.request, {
      name: "Task Viewer",
      email: viewerEmail,
      password,
    });
    await page.goto("/login");
    await page.getByLabel("Email").fill(viewerEmail);
    await page.getByLabel("Password").fill(password);
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page).toHaveURL(/\/dashboard$/);
    const invitation = (
      await (
        await owner.post("/api/invitations", {
          data: {
            organizationId: organization.id,
            email: viewerEmail,
            role: "VIEWER",
          },
        })
      ).json()
    ).data.invitation;
    const accepted = await page.evaluate(async (token) => {
      const response = await fetch("/api/invitations/accept", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ token }),
      });
      return response.ok;
    }, invitation.token as string);
    expect(accepted).toBe(true);

    await page.goto(`/tasks/${task.id}`);
    await expect(
      page.getByRole("heading", { name: `Read only task ${suffix}` }),
    ).toBeVisible();
    await expect(page.getByRole("button", { name: "Edit Task" })).toHaveCount(
      0,
    );
    await expect(page.getByRole("button", { name: "Delete Task" })).toHaveCount(
      0,
    );
  } finally {
    await owner.dispose();
  }
});
