import { expect, test } from "@playwright/test";

test("owners can manage teams, invitations, roles, and members", async ({
  page,
  playwright,
}) => {
  const suffix = Date.now();
  const password = "a secure browser password";
  const ownerEmail = `directory-owner-${suffix}@example.test`;
  const memberEmail = `directory-member-${suffix}@example.test`;
  const member = await playwright.request.newContext({
    baseURL: "http://localhost:3000",
    extraHTTPHeaders: { "x-forwarded-for": "127.0.0.11" },
  });
  try {
    expect(
      (
        await page.request.post("/api/auth/register", {
          headers: { "x-forwarded-for": "127.0.0.10" },
          data: { name: "Directory Owner", email: ownerEmail, password },
        })
      ).status(),
    ).toBe(201);
    const organization = (
      await (
        await page.request.post("/api/organizations", {
          data: { name: `Directory ${suffix}` },
        })
      ).json()
    ).data.organization;
    await member.post("/api/auth/register", {
      data: { name: "Directory Member", email: memberEmail, password },
    });
    const invitation = (
      await (
        await page.request.post("/api/invitations", {
          data: {
            organizationId: organization.id,
            email: memberEmail,
            role: "MEMBER",
          },
        })
      ).json()
    ).data.invitation;
    await member.post("/api/invitations/accept", {
      data: { token: invitation.token },
    });

    await page.goto("/teams");
    await page.getByLabel("Team name").fill("Product Studio");
    await page.getByRole("button", { name: "Create Team" }).click();
    await expect(
      page.getByRole("heading", { name: "Product Studio" }),
    ).toBeVisible();
    await page
      .getByLabel("Add member to Product Studio")
      .selectOption({ label: "Directory Member" });
    await expect(page.getByText(`${memberEmail}`)).toBeVisible();
    await page
      .getByRole("button", {
        name: "Remove Directory Member from Product Studio",
      })
      .click();
    await expect(page.getByText(`${memberEmail}`)).not.toBeVisible();

    await page.goto("/people");
    const memberRow = page
      .locator(".people-row")
      .filter({ hasText: memberEmail });
    await memberRow.getByRole("combobox").selectOption("VIEWER");
    await expect(
      page.getByText("Directory Member is now viewer."),
    ).toBeVisible();
    page.once("dialog", (dialog) => dialog.accept());
    await memberRow
      .getByRole("button", { name: "Remove Directory Member" })
      .click();
    await expect(memberRow).toHaveCount(0);
  } finally {
    await member.dispose();
  }
});

test("invited users can accept a token and viewers get read-only directories", async ({
  page,
  playwright,
}) => {
  const suffix = Date.now();
  const password = "a secure browser password";
  const viewerEmail = `directory-viewer-${suffix}@example.test`;
  const owner = await playwright.request.newContext({
    baseURL: "http://localhost:3000",
    extraHTTPHeaders: { "x-forwarded-for": "127.0.0.12" },
  });
  try {
    await owner.post("/api/auth/register", {
      data: {
        name: "Directory Owner",
        email: `owner-${suffix}@example.test`,
        password,
      },
    });
    const organization = (
      await (
        await owner.post("/api/organizations", {
          data: { name: `Viewer Space ${suffix}` },
        })
      ).json()
    ).data.organization;
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
    expect(
      (
        await page.request.post("/api/auth/register", {
          headers: { "x-forwarded-for": "127.0.0.13" },
          data: { name: "Directory Viewer", email: viewerEmail, password },
        })
      ).status(),
    ).toBe(201);
    await page.goto(`/invitations/accept?token=${invitation.token}`);
    await page.getByRole("button", { name: "Accept invitation" }).click();
    await expect(
      page.getByRole("heading", { name: "You're in." }),
    ).toBeVisible();
    await page.goto("/teams");
    await expect(page.getByRole("button", { name: "Create Team" })).toHaveCount(
      0,
    );
    await page.goto("/people");
    await expect(
      page.getByRole("button", { name: "Create Invite" }),
    ).toHaveCount(0);
    await expect(page.getByText("Directory access is limited.")).toBeVisible();
  } finally {
    await owner.dispose();
  }
});

test("team management follows Owner, Admin, Manager, Member, and Viewer permissions", async ({
  playwright,
}) => {
  const suffix = Date.now();
  const password = "a secure browser password";
  const owner = await playwright.request.newContext({
    baseURL: "http://localhost:3000",
    extraHTTPHeaders: { "x-forwarded-for": "127.0.0.20" },
  });
  const roles = ["ADMIN", "MANAGER", "MEMBER", "VIEWER"] as const;
  const contexts = await Promise.all(
    roles.map((_, index) =>
      playwright.request.newContext({
        baseURL: "http://localhost:3000",
        extraHTTPHeaders: { "x-forwarded-for": `127.0.0.${21 + index}` },
      }),
    ),
  );
  try {
    await owner.post("/api/auth/register", {
      data: {
        name: "Role Owner",
        email: `role-owner-${suffix}@example.test`,
        password,
      },
    });
    const organization = (
      await (
        await owner.post("/api/organizations", {
          data: { name: `Role Space ${suffix}` },
        })
      ).json()
    ).data.organization;
    expect(
      (
        await owner.post("/api/teams", {
          data: { organizationId: organization.id, name: "Owner Team" },
        })
      ).status(),
    ).toBe(201);
    for (const [index, role] of roles.entries()) {
      const context = contexts[index]!;
      const email = `role-${role.toLowerCase()}-${suffix}@example.test`;
      await context.post("/api/auth/register", {
        data: { name: `${role} Person`, email, password },
      });
      const invitation = (
        await (
          await owner.post("/api/invitations", {
            data: { organizationId: organization.id, email, role },
          })
        ).json()
      ).data.invitation;
      await context.post("/api/invitations/accept", {
        data: { token: invitation.token },
      });
      const response = await context.post("/api/teams", {
        data: { organizationId: organization.id, name: `${role} Team` },
      });
      expect(response.status()).toBe(role === "ADMIN" ? 201 : 403);
    }
  } finally {
    await owner.dispose();
    await Promise.all(contexts.map((context) => context.dispose()));
  }
});
