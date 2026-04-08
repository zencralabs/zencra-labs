import { chromium } from "playwright";
import fs from "node:fs/promises";
import path from "node:path";

const baseUrl = process.env.BASE_URL || "http://127.0.0.1:3000";
const outDir = path.resolve("artifacts/studio-screenshots");

const shots = [
  { url: `${baseUrl}/studio`, file: "studio.png" },
  { url: `${baseUrl}/studio?stage=video`, file: "studio-stage-video.png" },
  { url: `${baseUrl}/studio?stage=voice`, file: "studio-stage-voice.png" },
];

async function run() {
  await fs.mkdir(outDir, { recursive: true });

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1728, height: 1117 },
    deviceScaleFactor: 2,
  });

  const page = await context.newPage();

  for (const shot of shots) {
    console.log(`Capturing ${shot.url}`);
    await page.goto(shot.url, { waitUntil: "networkidle", timeout: 60000 });
    await page.waitForTimeout(1200);
    const filePath = path.join(outDir, shot.file);
    await page.screenshot({ path: filePath, fullPage: true });
    console.log(`Saved: ${filePath}`);
  }

  await browser.close();
  console.log("Done.");
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
