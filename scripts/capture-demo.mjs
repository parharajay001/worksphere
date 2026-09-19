import { mkdir } from "node:fs/promises";
import path from "node:path";
import { chromium } from "playwright";
import sharp from "sharp";

const baseUrl = process.env.DEMO_BASE_URL ?? "http://localhost:3000";
const outputDirectory = path.resolve("docs/assets");
const viewport = { width: 1440, height: 900 };
const gifSize = { width: 960, height: 600 };
const projectId = "20000000-0000-4000-8000-000000000001";
const taskId = "30000000-0000-4000-8000-000000000004";
const teamId = "10000000-0000-4000-8000-000000000001";

await mkdir(outputDirectory, { recursive: true });

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({
  viewport,
  deviceScaleFactor: 1,
  colorScheme: "light",
  reducedMotion: "reduce",
});
const page = await context.newPage();
const gifFrames = [];
const navigate = (pathname) =>
  page.goto(`${baseUrl}${pathname}`, {
    waitUntil: "domcontentloaded",
    timeout: 60_000,
  });

async function settle() {
  await page.waitForLoadState("domcontentloaded");
  await page.locator("body").waitFor({ state: "visible" });
  await page.waitForTimeout(500);
}

async function capture(name, { includeInGif = true } = {}) {
  await settle();
  await page
    .locator("nextjs-portal")
    .evaluateAll((portals) => portals.forEach((portal) => portal.remove()));
  const screenshot = await page.screenshot({
    animations: "disabled",
    caret: "hide",
    fullPage: false,
  });
  await sharp(screenshot)
    .png({ compressionLevel: 9, palette: true, quality: 90 })
    .toFile(path.join(outputDirectory, `${name}.png`));
  if (includeInGif) {
    gifFrames.push(
      await sharp(screenshot)
        .resize(gifSize.width, gifSize.height, { fit: "cover" })
        .removeAlpha()
        .raw()
        .toBuffer(),
    );
  }
}

try {
  await navigate("/");
  await capture("worksphere-home");

  await navigate("/register");
  await page.getByLabel("Name").fill("Maya Chen");
  await page.getByLabel("Email").fill("maya@northstar.example");
  await page.getByLabel("Password").fill("WorkSphereDemo!2026");
  await capture("worksphere-registration");

  await navigate("/login");
  await page.getByLabel("Email").fill("owner@worksphere.example");
  await page.getByLabel("Password").fill("WorkSphereDemo!2026");
  await capture("worksphere-login");
  await page.getByRole("button", { name: /sign in/i }).click();
  await page.waitForURL(/\/dashboard/);
  await capture("worksphere-dashboard");

  await navigate("/projects");
  await capture("worksphere-projects");

  await navigate(`/projects/${projectId}`);
  await capture("worksphere-board");
  await page.locator("#activity").scrollIntoViewIfNeeded();
  await capture("worksphere-project-activity", { includeInGif: false });
  await page.locator("#chat").scrollIntoViewIfNeeded();
  await capture("worksphere-project-chat", { includeInGif: false });

  await navigate(`/tasks/${taskId}`);
  await capture("worksphere-task");

  await navigate("/activity");
  await capture("worksphere-activity", { includeInGif: false });

  await navigate("/analytics");
  await capture("worksphere-reports");

  await navigate("/teams");
  await capture("worksphere-teams");

  await navigate(`/teams/${teamId}`);
  await capture("worksphere-team-chat", { includeInGif: false });

  await navigate("/people");
  await capture("worksphere-people");

  await navigate("/notifications");
  await capture("worksphere-notifications", { includeInGif: false });

  await navigate(`/projects/${projectId}/settings`);
  await capture("worksphere-project-settings", { includeInGif: false });

  await navigate("/settings/workspace");
  await capture("worksphere-workspace-settings", { includeInGif: false });

  await navigate("/settings/account");
  await capture("worksphere-account-settings", { includeInGif: false });

  await navigate("/settings/billing");
  await capture("worksphere-billing");

  await navigate("/settings/audit");
  await capture("worksphere-audit");

  await page.setViewportSize({ width: 390, height: 844 });
  await navigate("/dashboard");
  await page.getByRole("button", { name: "Open navigation" }).click();
  await capture("worksphere-mobile-navigation", { includeInGif: false });

  const animatedPixels = Buffer.concat(gifFrames);
  await sharp(animatedPixels, {
    raw: {
      width: gifSize.width,
      height: gifSize.height * gifFrames.length,
      channels: 3,
      pageHeight: gifSize.height,
    },
    animated: true,
  })
    .gif({ delay: gifFrames.map(() => 1100), loop: 0, effort: 6 })
    .toFile(path.join(outputDirectory, "worksphere-demo.gif"));
} finally {
  await browser.close();
}

console.log(`Demo media written to ${outputDirectory}`);
