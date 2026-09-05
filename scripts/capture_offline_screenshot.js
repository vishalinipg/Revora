const path = require("path");
const fs = require("fs");
const puppeteer = require(path.resolve(__dirname, "..", "frontend", "node_modules", "puppeteer-core"));

const CHROME_PATH = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const DASHBOARD_URL = "http://127.0.0.1:3000/console";
const ARTIFACT_DIR = "C:\\Users\\LENOVO\\.gemini\\antigravity-ide\\brain\\a5b322f8-0e26-40dc-9bbe-f60d79d7ad68";
const DOCS_DIR = path.resolve(__dirname, "..", "docs", "screenshots");

async function captureOffline() {
  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: "new",
    defaultViewport: { width: 1600, height: 1000 },
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });

  try {
    const page = await browser.newPage();
    console.log("Loading dashboard while backend is down...");
    await page.goto(DASHBOARD_URL, { waitUntil: "networkidle2", timeout: 15000 });
    await new Promise((r) => setTimeout(r, 2000));

    const file1 = path.join(ARTIFACT_DIR, "08_backend_unavailable_state.png");
    const file2 = path.join(DOCS_DIR, "08_backend_unavailable_state.png");
    await page.screenshot({ path: file1 });
    fs.copyFileSync(file1, file2);
    console.log("[SCREENSHOT] Saved: 08_backend_unavailable_state.png");
  } catch (err) {
    console.error("Error:", err);
  } finally {
    await browser.close();
  }
}

captureOffline();
