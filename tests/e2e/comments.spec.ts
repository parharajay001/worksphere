import { test, expect } from "@playwright/test";

test("task detail comments support create, edit, delete, and load more", async ({
  page,
}, testInfo) => {
  test.setTimeout(60_000);
  const email = `comments-${Date.now()}@example.test`;
  await page.setExtraHTTPHeaders({
    "x-forwarded-for": `comments-test-${Date.now()}`,
  });
  await page.goto("/register");
  await page.getByLabel("Name").fill("Comment Tester");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill("a secure browser password");
  await page.getByRole("button", { name: /create account/i }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
  const org = (
    await (
      await page.request.post("/api/organizations", {
        data: { name: `Comment Workspace ${Date.now()}` },
      })
    ).json()
  ).data.organization;
  try {
    const project = (
      await (
        await page.request.post("/api/projects", {
          data: { organizationId: org.id, name: "Comment project" },
        })
      ).json()
    ).data.project;
    const task = (
      await (
        await page.request.post("/api/tasks", {
          data: { projectId: project.id, title: "Review comments" },
        })
      ).json()
    ).data.task;
    for (let index = 0; index < 21; index++) {
      const response = await page.request.post(
        `/api/tasks/${task.id}/comments`,
        { data: { body: `Context note ${index}` } },
      );
      expect(response.status()).toBe(201);
    }
    await page.goto(`/tasks/${task.id}`);
    await expect(page.locator("#comments-title")).toBeVisible();
    await expect(page.locator(".comment")).toHaveCount(20);
    await page.getByRole("button", { name: "Load older comments" }).click();
    await expect(page.locator(".comment")).toHaveCount(21);
    await page
      .getByLabel("Add a comment")
      .fill("A release update for the team.");
    await page.getByRole("button", { name: "Post comment" }).click();
    await expect(
      page.getByText("A release update for the team."),
    ).toBeVisible();
    const newest = page.locator(".comment").first();
    await newest.getByRole("button", { name: /Edit comment by/ }).click();
    await newest
      .getByLabel("Edit comment", { exact: true })
      .fill("Updated release update.");
    await newest.getByRole("button", { name: "Save comment" }).click();
    await expect(page.getByText("Updated release update.")).toBeVisible();
    page.once("dialog", (dialog) => void dialog.accept());
    await newest.getByRole("button", { name: /Delete comment by/ }).click();
    await expect(page.getByText("Updated release update.")).toHaveCount(0);
    await page.screenshot({
      path: testInfo.outputPath("comments-task-detail.png"),
      fullPage: true,
    });
  } finally {
    expect(
      (await page.request.delete(`/api/organizations/${org.id}`)).status(),
    ).toBe(204);
  }
});
