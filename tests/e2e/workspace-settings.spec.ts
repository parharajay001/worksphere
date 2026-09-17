import { expect, test } from "@playwright/test";

test("a new user can create, edit, switch, and delete workspaces", async ({
  page,
}) => {
  const suffix = Date.now();
  await page.goto("/register");
  await page.getByLabel("Name").fill("Workspace Owner");
  await page.getByLabel("Email").fill(`workspace-${suffix}@example.test`);
  await page.getByLabel("Password").fill("a secure browser password");
  await page.getByRole("button", { name: /create account/i }).click();

  await expect(
    page.getByRole("heading", { name: "Create your first workspace." }),
  ).toBeVisible();
  await page.getByRole("link", { name: "Create Workspace" }).click();
  await page.getByLabel("Workspace name").fill(`Studio ${suffix}`);
  await page.getByLabel(/Workspace URL slug/).fill(`studio-${suffix}`);
  await page.getByRole("button", { name: "Create Workspace" }).click();
  await expect(page.getByText(`Studio ${suffix} is ready.`)).toBeVisible();

  await page.getByLabel("Workspace name").fill(`Studio North ${suffix}`);
  await page.getByLabel("Workspace URL slug").fill(`studio-north-${suffix}`);
  await page.getByRole("button", { name: "Save Changes" }).click();
  await expect(page.getByText("Workspace settings saved.")).toBeVisible();

  await page.getByRole("button", { name: "New Workspace" }).click();
  await page.getByLabel("Workspace name").fill(`Studio South ${suffix}`);
  await page.getByRole("button", { name: "Create Workspace" }).click();
  await expect(
    page.getByText(`Studio South ${suffix} is ready.`),
  ).toBeVisible();

  await page.getByRole("button", { name: "Choose workspace" }).click();
  await page
    .getByRole("button", { name: new RegExp(`Studio North ${suffix}`) })
    .click();
  await expect(page).toHaveURL(/\/dashboard$/);

  await page.goto("/settings/workspace");
  await page
    .getByLabel(new RegExp(`Type Studio North ${suffix}`))
    .fill(`Studio North ${suffix}`);
  await page.getByRole("button", { name: "Delete Workspace" }).click();
  await expect(page.getByText(`Studio North ${suffix}`)).not.toBeVisible();
});

test("members can view workspace settings without management actions", async ({
  page,
  playwright,
}) => {
  const suffix = Date.now();
  const password = "a secure browser password";
  const ownerEmail = `settings-owner-${suffix}@example.test`;
  const memberEmail = `settings-member-${suffix}@example.test`;
  const owner = await playwright.request.newContext({
    baseURL: "http://localhost:3100",
  });
  const member = await playwright.request.newContext({
    baseURL: "http://localhost:3100",
  });
  try {
    await owner.post("/api/auth/register", {
      data: { name: "Settings Owner", email: ownerEmail, password },
    });
    await member.post("/api/auth/register", {
      data: { name: "Settings Member", email: memberEmail, password },
    });
    const organizationResponse = await owner.post("/api/organizations", {
      data: { name: `Member Workspace ${suffix}` },
    });
    const organization = (await organizationResponse.json()).data.organization;
    const invitationResponse = await owner.post("/api/invitations", {
      data: {
        organizationId: organization.id,
        email: memberEmail,
        role: "MEMBER",
      },
    });
    const invitation = (await invitationResponse.json()).data.invitation;
    await member.post("/api/invitations/accept", {
      data: { token: invitation.token },
    });

    await page.goto("/login");
    await page.getByLabel("Email").fill(memberEmail);
    await page.getByLabel("Password").fill(password);
    await page.getByRole("button", { name: "Sign in" }).click();
    await page.goto("/settings/workspace");

    await expect(page.getByLabel("Workspace name")).toBeDisabled();
    await expect(
      page.getByRole("button", { name: "Save Changes" }),
    ).toHaveCount(0);
    await expect(
      page.getByRole("button", { name: "Delete Workspace" }),
    ).toHaveCount(0);
    await expect(
      page.getByText(/Only workspace owners and admins/),
    ).toBeVisible();
  } finally {
    await owner.dispose();
    await member.dispose();
  }
});
