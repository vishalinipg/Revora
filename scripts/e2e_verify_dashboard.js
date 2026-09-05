/**
 * Automated E2E Browser Verification for Revora Operator Dashboard.
 * 
 * Uses system Chrome with puppeteer-core to test all 7 key dashboard workflows,
 * verify ground-truth isolation, check suppression rules, and capture screenshots.
 */
const path = require("path");
const fs = require("fs");
const puppeteer = require(path.resolve(__dirname, "..", "frontend", "node_modules", "puppeteer-core"));

const CHROME_PATH = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const DASHBOARD_URL = "http://127.0.0.1:3000/console";

// Ensure screenshot directories exist
const ARTIFACT_DIR = "C:\\Users\\LENOVO\\.gemini\\antigravity-ide\\brain\\a5b322f8-0e26-40dc-9bbe-f60d79d7ad68";
const DOCS_DIR = path.resolve(__dirname, "..", "docs", "screenshots");

[ARTIFACT_DIR, DOCS_DIR].forEach((dir) => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

async function saveScreenshot(page, filename) {
  const file1 = path.join(ARTIFACT_DIR, filename);
  const file2 = path.join(DOCS_DIR, filename);
  await page.screenshot({ path: file1, fullPage: false });
  fs.copyFileSync(file1, file2);
  console.log(`[SCREENSHOT] Saved: ${filename}`);
}

async function runVerification() {
  console.log("=== REVORA OPERATOR DASHBOARD E2E VERIFICATION ===");
  console.log(`Launching Chrome: ${CHROME_PATH}`);

  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: "new",
    defaultViewport: { width: 1600, height: 1000 },
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-gpu"],
  });

  const results = {};

  try {
    const page = await browser.newPage();

    // 1. Load Main Dashboard
    console.log(`Navigating to ${DASHBOARD_URL}...`);
    await page.goto(DASHBOARD_URL, { waitUntil: "networkidle2", timeout: 30000 });
    await page.waitForSelector("header", { timeout: 10000 });

    // Verify Header elements
    const headerText = await page.$eval("header", (el) => el.innerText);
    const hasBrand = headerText.includes("REVORA");
    const hasRail = headerText.includes("UPI AutoPay");
    const hasSimulationBadge = headerText.includes("NO REAL MONEY MOVED");
    const hasConnected = headerText.includes("API CONNECTED");

    results["Dashboard Shell & Header"] = hasBrand && hasRail && hasSimulationBadge && hasConnected ? "PASS" : "FAIL";
    console.log(`[VERIFY] Header check: ${results["Dashboard Shell & Header"]}`);

    // Verify Executive Metrics
    await page.waitForSelector("section[aria-label='Executive Metrics']", { timeout: 5000 });
    const metricsText = await page.$eval("section[aria-label='Executive Metrics']", (el) => el.innerText);
    const hasRecoveryRate = metricsText.includes("Recovery Rate") && metricsText.includes("%");
    const hasRecoveredVal = metricsText.includes("Recovered Value") && metricsText.includes("₹");
    const hasFutileRetries = metricsText.includes("Futile Retries Saved");
    const hasStopping = metricsText.includes("100% Verified");

    results["Live Executive Metrics"] = hasRecoveryRate && hasRecoveredVal && hasFutileRetries && hasStopping ? "PASS" : "FAIL";
    console.log(`[VERIFY] Executive Metrics check: ${results["Live Executive Metrics"]}`);

    // Capture Screenshot 1: Main Operator Dashboard
    await saveScreenshot(page, "01_main_operator_dashboard.png");

    // 2. Verify Payment Queue
    await page.waitForSelector("table tbody tr", { timeout: 10000 });
    const rowCount = await page.$$eval("table tbody tr", (rows) => rows.length);
    results["Payment Queue Rendering"] = rowCount > 0 ? "PASS" : "FAIL";
    console.log(`[VERIFY] Payment Queue rendered ${rowCount} payments: ${results["Payment Queue Rendering"]}`);

    // Capture Screenshot 2: Payment Queue
    await saveScreenshot(page, "02_payment_queue.png");

    // 3. Inspect Payment Detail & Decision Inspector via dedicated page
    console.log("Clicking Inspect button to navigate to dedicated payment inspection page...");
    await page.waitForSelector('[data-testid^="inspect-btn-"]', { timeout: 10000 });
    const inspectBtn = await page.$('[data-testid^="inspect-btn-"]');
    await inspectBtn.click();

    await page.waitForSelector('[data-testid="rerun-decision-btn"]', { timeout: 10000 });
    const inspectorText = await page.$eval("section[aria-label='Payment Operations Console']", (el) => el.textContent);
    const hasSignals = inspectorText.includes("Observed Provider Signals") || inspectorText.includes("Amount Due") || inspectorText.includes("Tier 1");
    const hasDiagnosis = inspectorText.includes("Deterministic Diagnosis") || inspectorText.includes("Confidence");
    const hasPropensity = inspectorText.includes("Propensity-to-Pay Score") || inspectorText.includes("Propensity");
    const hasIsolation = inspectorText.includes("Isolation Verified") || inspectorText.includes("Zero Ground-Truth Leakage");

    console.log(`[DEBUG] Inspector checks: signals=${hasSignals}, diag=${hasDiagnosis}, prop=${hasPropensity}, iso=${hasIsolation}`);
    results["Decision Inspector Data"] = hasSignals && hasDiagnosis && hasPropensity && hasIsolation ? "PASS" : "FAIL";
    console.log(`[VERIFY] Decision Inspector loaded: ${results["Decision Inspector Data"]}`);

    // 4. Test Re-run Decision Engine Live
    console.log("Triggering live Decision Engine execution on dedicated inspection page...");
    const rerunBtn = await page.waitForSelector('[data-testid="rerun-decision-btn"]');
    await rerunBtn.click();
    await new Promise((r) => setTimeout(r, 1500));

    const afterRerunText = await page.$eval("section[aria-label='Payment Operations Console']", (el) => el.textContent);
    const hasDecisionLogged = afterRerunText.includes("Live Decision Logged");
    results["Re-run Engine Execution"] = hasDecisionLogged ? "PASS" : "FAIL";
    console.log(`[VERIFY] Re-run Engine audit log check: ${results["Re-run Engine Execution"]}`);

    // Capture Screenshot 3: Decision Inspector with live result
    await saveScreenshot(page, "03_decision_inspector_rerun.png");

    // 5. Test Customer Timeline
    console.log("Opening Customer Timeline modal on inspection page...");
    const timelineBtn = await page.waitForSelector('[data-testid="timeline-btn"]');
    await timelineBtn.click();
    await page.waitForSelector('[data-testid="close-timeline-btn"]', { timeout: 5000 });
    await new Promise((r) => setTimeout(r, 1000));

    const timelineModalText = await page.$eval("div.fixed", (el) => el.textContent);
    const hasObserved = timelineModalText.includes("OBSERVED");
    const hasDecision = timelineModalText.includes("DECISION");
    results["Customer Timeline Provenance"] = hasObserved && hasDecision ? "PASS" : "FAIL";
    console.log(`[VERIFY] Timeline provenance markers: ${results["Customer Timeline Provenance"]}`);

    // Capture Screenshot 4: Customer Timeline
    await saveScreenshot(page, "04_customer_timeline.png");

    // Close Timeline modal
    const closeTimelineBtn = await page.waitForSelector('[data-testid="close-timeline-btn"]');
    await closeTimelineBtn.click();
    await new Promise((r) => setTimeout(r, 500));

    // 6. Test Outreach Preview on Approved Recovery Action (Simulated Outbox)
    console.log("Navigating to payment with approved outreach action (pay_rev_00752)...");
    await page.goto("http://127.0.0.1:3000/console/inspect/pay_rev_00752", { waitUntil: "networkidle0" });
    await page.waitForSelector('[data-testid="preview-outreach-btn"]', { timeout: 10000 });

    console.log("Opening Outreach Preview modal...");
    const outreachBtn = await page.waitForSelector('[data-testid="preview-outreach-btn"]');
    await outreachBtn.click();
    await page.waitForSelector('[data-testid="close-outbox-btn"]', { timeout: 5000 });
    await new Promise((r) => setTimeout(r, 1200));

    const outboxText = await page.$eval("div.fixed", (el) => el.textContent);
    const hasWatermark = outboxText.includes("SIMULATED — NO MESSAGE SENT");
    results["Outreach Preview Watermark"] = hasWatermark ? "PASS" : "FAIL";
    console.log(`[VERIFY] Outbox simulation watermark: ${results["Outreach Preview Watermark"]}`);

    // Capture Screenshot 5: Outreach Preview with Approved Copy
    await saveScreenshot(page, "05_outreach_preview.png");

    // Close Outreach modal
    const closeOutboxBtn = await page.waitForSelector('[data-testid="close-outbox-btn"]');
    await closeOutboxBtn.click();
    await new Promise((r) => setTimeout(r, 500));

    // 7. Test STOP / HUMAN_ESCALATION Outreach Suppression
    console.log("Navigating to suppressed payment (blocked_account pay_rev_00117)...");
    await page.goto("http://127.0.0.1:3000/console/inspect/pay_rev_00117", { waitUntil: "networkidle0" });
    await page.waitForSelector('[data-testid="preview-outreach-btn"]', { timeout: 10000 });

    // Click Preview Outreach on suppressed payment
    const outreachBtn2 = await page.waitForSelector('[data-testid="preview-outreach-btn"]');
    await outreachBtn2.click();
    await page.waitForSelector('[data-testid="close-outbox-btn"]', { timeout: 5000 });
    await new Promise((r) => setTimeout(r, 1000));

    const suppressedOutboxText = await page.$eval("div.fixed", (el) => el.textContent);
    const isSuppressed = suppressedOutboxText.includes("Outreach Suppressed by Revora Policy") || suppressedOutboxText.includes("Zero Messages Dispatched") || suppressedOutboxText.includes("suppressed");
    results["Outreach Suppression Enforcement"] = isSuppressed ? "PASS" : "FAIL";
    console.log(`[VERIFY] Outreach suppression enforcement: ${results["Outreach Suppression Enforcement"]}`);

    // Capture Screenshot 6: Outreach Suppressed State
    await saveScreenshot(page, "06_outreach_suppressed.png");

    const closeOutboxBtn2 = await page.waitForSelector('[data-testid="close-outbox-btn"]');
    await closeOutboxBtn2.click();
    await new Promise((r) => setTimeout(r, 500));

    // 8. Test Multi-Seed Benchmark Modal
    console.log("Navigating back to /console for Multi-Seed Benchmark modal...");
    await page.goto("http://127.0.0.1:3000/console", { waitUntil: "networkidle0" });
    const benchmarkBtn = await page.waitForSelector('[data-testid="open-benchmark-btn"]', { timeout: 10000 });
    await benchmarkBtn.click();
    await page.waitForSelector('[data-testid="close-benchmark-btn"]', { timeout: 5000 });
    // Wait for benchmarks to finish loading and table to render
    await page.waitForFunction(
      () => document.querySelector("div.fixed") && document.querySelector("div.fixed").textContent.includes("5-Seed Robustness Comparison"),
      { timeout: 15000 }
    );

    const benchmarkModalText = await page.$eval("div.fixed", (el) => el.textContent);
    const hasBaselineLabel = benchmarkModalText.includes("fixed 3-attempt blind-retry control baseline");
    const has5Seeds = benchmarkModalText.includes("5-Seed Robustness Comparison");
    results["Benchmark & Multi-Seed View"] = hasBaselineLabel && has5Seeds ? "PASS" : "FAIL";
    console.log(`[VERIFY] Benchmark view with exact baseline terminology: ${results["Benchmark & Multi-Seed View"]}`);

    // Capture Screenshot 7: Multi-Seed Robustness Benchmark
    await saveScreenshot(page, "07_evaluation_benchmark.png");

    const closeBenchmarkBtn = await page.waitForSelector('[data-testid="close-benchmark-btn"]');
    await closeBenchmarkBtn.click();
    await new Promise((r) => setTimeout(r, 500));

    console.log("\n=== E2E VERIFICATION COMPLETED ===");
    console.log(JSON.stringify(results, null, 2));

    fs.writeFileSync(
      path.join(DOCS_DIR, "e2e_results.json"),
      JSON.stringify(results, null, 2),
      "utf-8"
    );

  } catch (err) {
    console.error("[ERROR] E2E Verification failed:", err);
  } finally {
    await browser.close();
  }
}

runVerification();
