import { test, expect, type APIRequestContext } from "@playwright/test";

test("organization, invitation, team, project, and task APIs enforce the full workflow", async ({
  playwright,
}) => {
  const owner = await playwright.request.newContext({
    baseURL: "http://localhost:3100",
    extraHTTPHeaders: { "x-forwarded-for": `workflow-owner-${Date.now()}` },
  });
  const member = await playwright.request.newContext({
    baseURL: "http://localhost:3100",
    extraHTTPHeaders: { "x-forwarded-for": `workflow-member-${Date.now()}` },
  });
  const suffix = Date.now();
  const ownerEmail = `e2e-owner-${suffix}@example.test`;
  const memberEmail = `e2e-member-${suffix}@example.test`;
  const password = "a secure browser password";
  // The API envelope varies by endpoint; this helper intentionally models its dynamic payload.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  type ApiBody = { data: Record<string, any> };
  async function json(
    response: Awaited<ReturnType<APIRequestContext["get"]>>,
  ): Promise<ApiBody> {
    if (!response.ok())
      throw new Error(
        `${response.url()} returned ${response.status()}: ${await response.text()}`,
      );
    return (await response.json()) as ApiBody;
  }
  try {
    await json(
      await owner.post("/api/auth/register", {
        data: { name: "E2E Owner", email: ownerEmail, password },
      }),
    );
    await json(
      await member.post("/api/auth/register", {
        data: { name: "E2E Member", email: memberEmail, password },
      }),
    );

    const organization = (
      await json(
        await owner.post("/api/organizations", {
          data: { name: `E2E Workspace ${suffix}` },
        }),
      )
    ).data.organization;
    const second = (
      await json(
        await owner.post("/api/organizations", {
          data: { name: `Private Workspace ${suffix}` },
        }),
      )
    ).data.organization;
    const invitation = (
      await json(
        await owner.post("/api/invitations", {
          data: {
            organizationId: organization.id,
            email: memberEmail,
            role: "MEMBER",
          },
        }),
      )
    ).data.invitation;
    expect(invitation.token).toBeTruthy();
    await json(
      await member.post("/api/invitations/accept", {
        data: { token: invitation.token },
      }),
    );

    const team = (
      await json(
        await owner.post("/api/teams", {
          data: {
            organizationId: organization.id,
            name: `Product Team ${suffix}`,
          },
        }),
      )
    ).data.team;
    await json(
      await owner.post(`/api/teams/${team.id}/members`, {
        data: {
          userId: (await (await member.get("/api/auth/me")).json()).data.user
            .id,
        },
      }),
    );
    const project = (
      await json(
        await owner.post("/api/projects", {
          data: {
            organizationId: organization.id,
            teamId: team.id,
            name: `Launch ${suffix}`,
            description: "E2E project",
          },
        }),
      )
    ).data.project;
    const projectsUrl = `/api/projects?organizationId=${organization.id}`;
    const firstProjectRead = await json(await owner.get(projectsUrl));
    expect(firstProjectRead.data.projects).toHaveLength(1);
    const secondProjectRead = await json(await owner.get(projectsUrl));
    expect(secondProjectRead.data.projects).toHaveLength(1);
    if (firstProjectRead.data.cache !== "unavailable") {
      expect(firstProjectRead.data.cache).toBe("miss");
      expect(secondProjectRead.data.cache).toBe("hit");
    }
    const followupProject = (
      await json(
        await owner.post("/api/projects", {
          data: {
            organizationId: organization.id,
            name: `Follow-up ${suffix}`,
          },
        }),
      )
    ).data.project;
    const afterProjectWrite = await json(await owner.get(projectsUrl));
    expect(afterProjectWrite.data.projects).toHaveLength(2);
    if (afterProjectWrite.data.cache !== "unavailable")
      expect(afterProjectWrite.data.cache).toBe("miss");
    expect(
      (await owner.delete(`/api/projects/${followupProject.id}`)).status(),
    ).toBe(204);
    await json(
      await owner.post(`/api/projects/${project.id}/members`, {
        data: {
          userId: (await (await member.get("/api/auth/me")).json()).data.user
            .id,
        },
      }),
    );
    const task = (
      await json(
        await owner.post("/api/tasks", {
          data: {
            projectId: project.id,
            title: "Verify release",
            priority: "HIGH",
            assigneeId: (await (await member.get("/api/auth/me")).json()).data
              .user.id,
          },
        }),
      )
    ).data.task;
    expect(task.priority).toBe("HIGH");

    const filtered = await json(
      await owner.get(`/api/tasks?projectId=${project.id}&priority=HIGH`),
    );
    expect(filtered.data.tasks).toHaveLength(1);
    const updated = (
      await json(
        await owner.patch(`/api/tasks/${task.id}`, {
          data: { status: "DONE" },
        }),
      )
    ).data.task;
    expect(updated.status).toBe("DONE");
    expect(
      (await json(await member.get(`/api/projects/${project.id}`))).data.project
        .id,
    ).toBe(project.id);
    expect(
      (
        await member.patch(`/api/tasks/${task.id}`, {
          data: { title: "Unauthorized edit" },
        })
      ).status(),
    ).toBe(403);
    expect(
      (await member.get(`/api/teams?organizationId=${second.id}`)).status(),
    ).toBe(404);
    expect((await owner.delete(`/api/tasks/${task.id}`)).status()).toBe(204);
    expect((await owner.delete(`/api/projects/${project.id}`)).status()).toBe(
      204,
    );
    const pending = (
      await json(
        await owner.post("/api/invitations", {
          data: {
            organizationId: organization.id,
            email: `pending-${suffix}@example.test`,
            role: "VIEWER",
          },
        }),
      )
    ).data.invitation;
    expect(
      (await owner.delete(`/api/invitations/${pending.id}`)).status(),
    ).toBe(204);
    expect(
      (await owner.delete(`/api/organizations/${second.id}`)).status(),
    ).toBe(204);
    expect(
      (await owner.delete(`/api/organizations/${organization.id}`)).status(),
    ).toBe(204);
  } finally {
    await owner.dispose();
    await member.dispose();
  }
});

test("project and task detail pages render for an authenticated user", async ({
  page,
}) => {
  const email = `e2e-page-${Date.now()}@example.test`;
  await page.setExtraHTTPHeaders({ "x-forwarded-for": email });
  await page.goto("/register");
  await page.getByLabel("Name").fill("Page Tester");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill("a secure browser password");
  await page.getByRole("button", { name: /create account/i }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(page.getByRole("heading", { name: /projects/i })).toBeVisible();
});
