import { expect, test } from "@playwright/test";

test("project managers can create, edit, staff, archive, and delete a project", async ({
  page,
  playwright,
}) => {
  const suffix = Date.now();
  await page.setExtraHTTPHeaders({
    "x-forwarded-for": `project-owner-${suffix}`,
  });
  const password = "a secure browser password";
  const ownerEmail = `project-owner-${suffix}@example.test`;
  const memberEmail = `project-member-${suffix}@example.test`;
  const member = await playwright.request.newContext({
    baseURL: "http://localhost:3100",
    extraHTTPHeaders: { "x-forwarded-for": `project-member-${suffix}` },
  });
  try {
    await page.goto("/register");
    await page.getByLabel("Name").fill("Project Owner");
    await page.getByLabel("Email").fill(ownerEmail);
    await page.getByLabel("Password").fill(password);
    await page.getByRole("button", { name: /create account/i }).click();
    await page.getByRole("link", { name: "Create Workspace" }).click();
    await page.getByLabel("Workspace name").fill(`Project Studio ${suffix}`);
    await page.getByRole("button", { name: "Create Workspace" }).click();

    const memberRegistration = await member.post("/api/auth/register", {
      data: { name: "Project Member", email: memberEmail, password },
    });
    expect(memberRegistration.ok()).toBe(true);
    const invitation = await page.evaluate(async (email) => {
      const organizationsResponse = await fetch("/api/organizations");
      const organizations = await organizationsResponse.json();
      const organization = organizations.data.organizations[0].organization;
      const response = await fetch("/api/invitations", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          organizationId: organization.id,
          email,
          role: "MEMBER",
        }),
      });
      if (!response.ok)
        throw new Error(`Invitation failed: ${response.status}`);
      return (await response.json()).data.invitation;
    }, memberEmail);
    const acceptance = await member.post("/api/invitations/accept", {
      data: { token: invitation.token },
    });
    expect(acceptance.ok()).toBe(true);

    await page.goto("/projects/new");
    await page.getByLabel("Project name").fill(`Launch ${suffix}`);
    await page
      .getByLabel(/Description/)
      .fill("Coordinate the complete launch workflow.");
    await page.getByLabel("Status").selectOption("ACTIVE");
    await page.getByRole("button", { name: "Create Project" }).click();
    await expect(page).toHaveURL(/\/projects\/[a-f0-9-]+$/);
    await expect(
      page.getByRole("heading", { name: `Launch ${suffix}` }),
    ).toBeVisible();

    await page.getByRole("link", { name: "Project Settings" }).click();
    await page.getByLabel("Project name").fill(`Launch North ${suffix}`);
    await page.getByRole("button", { name: "Save Project" }).click();
    await expect(page.getByText("Project settings saved.")).toBeVisible();

    await page.getByLabel("Add a workspace member").selectOption({
      label: `Project Member · ${memberEmail}`,
    });
    await page.getByRole("button", { name: "Add Member" }).click();
    await expect(page.getByText("Project member added.")).toBeVisible();
    await expect(page.getByText(memberEmail)).toBeVisible();

    await page.getByRole("button", { name: "Archive Project" }).click();
    await expect(page.getByText("Project archived.")).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Reactivate Project" }),
    ).toBeVisible();

    await page
      .getByLabel(new RegExp(`Type Launch North ${suffix}`))
      .fill(`Launch North ${suffix}`);
    await page.getByRole("button", { name: "Delete Project" }).click();
    await expect(page).toHaveURL(/\/dashboard$/);
    await expect(page.getByText(`Launch North ${suffix}`)).toHaveCount(0);
  } finally {
    await member.dispose();
  }
});

test("members cannot open project management settings", async ({
  page,
  playwright,
}) => {
  const suffix = Date.now();
  const password = "a secure browser password";
  const owner = await playwright.request.newContext({
    baseURL: "http://localhost:3100",
    extraHTTPHeaders: { "x-forwarded-for": `project-admin-${suffix}` },
  });
  const memberEmail = `restricted-project-${suffix}@example.test`;
  try {
    await page.setExtraHTTPHeaders({
      "x-forwarded-for": `restricted-member-${suffix}`,
    });
    await owner.post("/api/auth/register", {
      data: {
        name: "Project Admin",
        email: `project-admin-${suffix}@example.test`,
        password,
      },
    });
    const organizationResponse = await owner.post("/api/organizations", {
      data: { name: `Restricted Studio ${suffix}` },
    });
    const organization = (await organizationResponse.json()).data.organization;
    const projectResponse = await owner.post("/api/projects", {
      data: {
        organizationId: organization.id,
        name: `Restricted Project ${suffix}`,
      },
    });
    const project = (await projectResponse.json()).data.project;

    await page.goto("/register");
    await page.getByLabel("Name").fill("Restricted Member");
    await page.getByLabel("Email").fill(memberEmail);
    await page.getByLabel("Password").fill(password);
    await page.getByRole("button", { name: /create account/i }).click();
    await expect(page).toHaveURL(/\/dashboard$/);
    const invitationResponse = await owner.post("/api/invitations", {
      data: {
        organizationId: organization.id,
        email: memberEmail,
        role: "MEMBER",
      },
    });
    const invitation = (await invitationResponse.json()).data.invitation;
    const accepted = await page.evaluate(async (token) => {
      const response = await fetch("/api/invitations/accept", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ token }),
      });
      return response.ok;
    }, invitation.token as string);
    expect(accepted).toBe(true);

    await page.goto(`/projects/${project.id}/settings`);
    await expect(page).toHaveURL(new RegExp(`/projects/${project.id}$`));
    await expect(
      page.getByRole("link", { name: "Project Settings" }),
    ).toHaveCount(0);
  } finally {
    await owner.dispose();
  }
});
