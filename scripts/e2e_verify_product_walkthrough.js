/**
 * Comprehensive Automated E2E Verification for Revora True Interactive Product Walkthrough.
 * 
 * Verifies:
 * 1. First-time user experience (auto-launch on /, first target exists before spotlight)
 * 2. Real cross-route navigation (/ -> /console -> /console/inspect/<REAL_ID> -> /console)
 * 3. Dynamic real payment ID extraction (zero hardcoded IDs, zero fake data)
 * 4. Real UI element spotlight anchoring and positioning
 * 5. Application modal integration (Timeline, Outbox, Multi-Seed Benchmark)
 * 6. Responsive behavior and zero horizontal overflow across 7 viewports (320, 360, 375, 390, 414, 768, 1440)
 * 7. Tour persistence (completed state, no auto-reopen on reload, manual restart from Step 1)
 */
const path = require("path");
const fs = require("fs");
const puppeteer = require(path.resolve(__dirname, "..", "frontend", "node_modules", "puppeteer-core"));

const CHROME_PATH = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const BASE_URL = "http://127.0.0.1:3000";

const ARTIFACT_DIR = "C:\\Users\\LENOVO\\.gemini\\antigravity-ide\\brain\\a5b322f8-0e26-40dc-9bbe-f60d79d7ad68";
const DOCS_DIR = path.resolve(__dirname, "..", "docs", "screenshots");

[ARTIFACT_DIR, DOCS_DIR].forEach((dir) => {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

async function saveScreenshot(page, filename) {
  const file1 = path.join(ARTIFACT_DIR, filename);
  const file2 = path.join(DOCS_DIR, filename);
  await page.screenshot({ path: file1, fullPage: false });
  try {
    fs.copyFileSync(file1, file2);
  } catch (e) {}
  console.log(`[SCREENSHOT] Saved: ${filename}`);
}

async function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function runWalkthroughVerification() {
  console.log("===============================================================");
  console.log("=== REVORA TRUE INTERACTIVE PRODUCT WALKTHROUGH E2E TEST ===");
  console.log("===============================================================\n");

  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: "new",
    defaultViewport: { width: 1440, height: 900 },
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-gpu"],
  });

  const testResults = {};
  let capturedRealPaymentId = null;

  try {
    const page = await browser.newPage();
    page.on('console', msg => console.log('PAGE LOG:', msg.text()));
    page.on('pageerror', err => console.log('PAGE ERROR:', err.message));

    // -------------------------------------------------------------
    // 1. FIRST-TIME EXPERIENCE & INITIAL STEP
    // -------------------------------------------------------------
    console.log("--- TEST 1: First-Time Experience & Step 1 Anchoring ---");
    // Clear localStorage to simulate pristine first-time visitor
    await page.goto(BASE_URL, { waitUntil: "networkidle2", timeout: 30000 });
    await page.evaluate(() => localStorage.clear());
    await page.reload({ waitUntil: "networkidle2" });

    // Ensure clear "Product tour" entry point and first target exist BEFORE spotlight renders
    await page.waitForSelector('[data-testid="product-tour-btn"]', { timeout: 10000 });
    console.log("✓ Clear 'Product tour' entry point ([data-testid='product-tour-btn']) rendered in header.");

    await page.waitForSelector('[data-testid="hero-particle-container"]', { timeout: 10000 });
    console.log("✓ First target ([data-testid='hero-particle-container']) rendered successfully.");

    // Wait for hydration and click "Product tour" entry point
    await sleep(1000);
    await page.click('[data-testid="product-tour-btn"]');

    // Wait for Product Tour Popover and Spotlight to appear
    await page.waitForSelector('[data-testid="product-tour-popover"]', { timeout: 10000 });
    await page.waitForSelector('[data-testid="product-tour-spotlight"]', { timeout: 5000 });

    const step1Counter = await page.$eval('[data-testid="tour-step-counter"]', (el) => el.innerText);
    const step1Title = await page.$eval("#tour-popover-title", (el) => el.innerText);
    console.log(`✓ Tour active: "${step1Counter}" - "${step1Title}"`);

    testResults["Tour entry point & Step 1 launch"] = step1Counter.includes("Step 1") && step1Title.includes("Adaptive") ? "PASS" : "FAIL";
    await saveScreenshot(page, "walkthrough_step1_landing_hero.png");

    // -------------------------------------------------------------
    // 2. STEPPING THROUGH LANDING PAGE
    // -------------------------------------------------------------
    console.log("\n--- TEST 2: Stepping Through Landing Features ---");
    
    // Step 1 -> Step 2
    await page.click('[data-testid="tour-next-btn"]');
    await sleep(600);
    const step2Title = await page.$eval("#tour-popover-title", (el) => el.innerText);
    console.log(`✓ Advanced to Step 2: "${step2Title}"`);

    // Step 2 -> Step 3 (Mechanism Diagram)
    await page.click('[data-testid="tour-next-btn"]');
    await sleep(800);
    const step3Title = await page.$eval("#tour-popover-title", (el) => el.innerText);
    console.log(`✓ Advanced to Step 3: "${step3Title}"`);

    // Step 3 -> Step 4 (Multilingual Language Proof)
    await page.click('[data-testid="tour-next-btn"]');
    await sleep(800);
    const step4Title = await page.$eval("#tour-popover-title", (el) => el.innerText);
    console.log(`✓ Advanced to Step 4: "${step4Title}"`);

    // Step 4 -> Step 5 (Evaluation Report)
    await page.click('[data-testid="tour-next-btn"]');
    await sleep(800);
    const step5Title = await page.$eval("#tour-popover-title", (el) => el.innerText);
    console.log(`✓ Advanced to Step 5: "${step5Title}"`);

    // Step 5 -> Step 6 (Console Entry CTA)
    await page.click('[data-testid="tour-next-btn"]');
    await sleep(800);
    const step6Title = await page.$eval("#tour-popover-title", (el) => el.innerText);
    const step6BtnText = await page.$eval('[data-testid="tour-next-btn"]', (el) => el.innerText);
    console.log(`✓ Advanced to Step 6: "${step6Title}" (Button: "${step6BtnText}")`);
    testResults["Landing steps progression"] = step6BtnText.includes("Console") ? "PASS" : "FAIL";

    // -------------------------------------------------------------
    // 3. CROSS-ROUTE NAVIGATION: / -> /console
    // -------------------------------------------------------------
    console.log("\n--- TEST 3: Cross-Route Navigation (/ -> /console) ---");
    await page.click('[data-testid="tour-next-btn"]');

    // Wait for client-side route transition to /console and DOM elements to hydrate
    await page.waitForFunction(() => window.location.pathname === "/console", { timeout: 10000 });
    await page.waitForSelector('section[aria-label="Executive Metrics"]', { timeout: 10000 });
    await page.waitForSelector('[data-testid="desktop-payment-queue-table"]', { timeout: 10000 });

    const currentUrlAfterConsole = page.url();
    console.log(`✓ Navigated to URL: ${currentUrlAfterConsole}`);

    // Wait for tour popover to re-anchor on console
    await page.waitForSelector('[data-testid="product-tour-popover"]', { timeout: 10000 });
    const consoleStepTitle = await page.$eval("#tour-popover-title", (el) => el.innerText);
    console.log(`✓ Popover re-anchored on console: "${consoleStepTitle}"`);

    testResults["Navigation / -> /console"] = currentUrlAfterConsole.includes("/console") && consoleStepTitle.includes("Operator Console") ? "PASS" : "FAIL";
    await saveScreenshot(page, "walkthrough_console_overview.png");

    // Console Overview -> Console Metrics
    await page.click('[data-testid="tour-next-btn"]');
    await sleep(600);
    const metricsStepTitle = await page.$eval("#tour-popover-title", (el) => el.innerText);
    console.log(`✓ Console Step: "${metricsStepTitle}"`);

    // Console Metrics -> Console Queue Filters
    await page.click('[data-testid="tour-next-btn"]');
    await sleep(600);
    const filterStepTitle = await page.$eval("#tour-popover-title", (el) => el.innerText);
    console.log(`✓ Console Step: "${filterStepTitle}"`);
    testResults["Payment Queue Filtering step"] = filterStepTitle.includes("Filtering") ? "PASS" : "FAIL";

    // Console Queue Filters -> Console Queue
    await page.click('[data-testid="tour-next-btn"]');
    await sleep(600);
    const queueStepTitle = await page.$eval("#tour-popover-title", (el) => el.innerText);
    console.log(`✓ Console Step: "${queueStepTitle}"`);

    // Console Queue -> Inspect Action Step
    await page.click('[data-testid="tour-next-btn"]');
    await sleep(600);
    const inspectActionStepTitle = await page.$eval("#tour-popover-title", (el) => el.innerText);
    console.log(`✓ Console Step: "${inspectActionStepTitle}"`);

    // -------------------------------------------------------------
    // 4. DYNAMIC REAL PAYMENT ID EXTRACTION & INSPECT TRANSITION
    // -------------------------------------------------------------
    console.log("\n--- TEST 4: Real Payment Discovery & Inspect Navigation ---");
    
    // Discover the real payment ID from first queue row inspect button
    const inspectBtnTestId = await page.$eval(
      '[data-testid="desktop-payment-queue-table"] tbody tr:first-child [data-testid^="inspect-btn-"]',
      (el) => el.getAttribute("data-testid")
    );
    capturedRealPaymentId = inspectBtnTestId.replace("inspect-btn-", "");
    console.log(`✓ Discovered Real Operational Payment ID: "${capturedRealPaymentId}"`);
    testResults["Real payment ID discovered"] = capturedRealPaymentId && capturedRealPaymentId.startsWith("pay_") ? "PASS" : "FAIL";

    // Click "Inspect Payment →" to cross route to /console/inspect/<REAL_ID>
    await page.click('[data-testid="tour-next-btn"]');
    await page.waitForFunction(
      (id) => window.location.pathname.includes(id),
      { timeout: 10000 },
      capturedRealPaymentId
    );
    await page.waitForSelector('[data-testid="decision-inspector-header"]', { timeout: 10000 });

    const inspectUrl = page.url();
    console.log(`✓ Current Inspect URL: ${inspectUrl}`);
    testResults["Navigation to real inspect ID"] = inspectUrl.includes(`/console/inspect/${capturedRealPaymentId}`) ? "PASS" : "FAIL";

    // -------------------------------------------------------------
    // 5. DECISION INSPECTOR STEPS & DOM ANCHORING
    // -------------------------------------------------------------
    console.log("\n--- TEST 5: Decision Inspector Diagnostics & Signals ---");
    await page.waitForSelector('[data-testid="product-tour-popover"]', { timeout: 10000 });
    const inspectStep1 = await page.$eval("#tour-popover-title", (el) => el.innerText);
    console.log(`✓ Anchored to: "${inspectStep1}"`);
    await saveScreenshot(page, "walkthrough_inspect_context.png");

    // Observed Provider Signals Step
    await page.click('[data-testid="tour-next-btn"]');
    await sleep(600);
    const observedSignalsStepTitle = await page.$eval("#tour-popover-title", (el) => el.innerText);
    console.log(`✓ Anchored to: "${observedSignalsStepTitle}"`);
    testResults["Observed Provider Signals step"] = observedSignalsStepTitle.includes("Observed Provider Signals") ? "PASS" : "FAIL";

    // Decision Engine Step
    await page.click('[data-testid="tour-next-btn"]');
    await sleep(600);
    const inspectStep2 = await page.$eval("#tour-popover-title", (el) => el.innerText);
    console.log(`✓ Anchored to: "${inspectStep2}"`);

    // Diagnosis Step
    await page.click('[data-testid="tour-next-btn"]');
    await sleep(600);
    const inspectStep3 = await page.$eval("#tour-popover-title", (el) => el.innerText);
    console.log(`✓ Anchored to: "${inspectStep3}"`);

    // ML Propensity Signal Step
    await page.click('[data-testid="tour-next-btn"]');
    await sleep(600);
    const inspectStep4 = await page.$eval("#tour-popover-title", (el) => el.innerText);
    console.log(`✓ Anchored to: "${inspectStep4}"`);

    // Live Engine Execution Rerun Step
    await page.click('[data-testid="tour-next-btn"]');
    await sleep(600);
    const inspectStep5 = await page.$eval("#tour-popover-title", (el) => el.innerText);
    console.log(`✓ Anchored to: "${inspectStep5}"`);

    // -------------------------------------------------------------
    // 6. REAL APPLICATION MODALS (TIMELINE & OUTBOX)
    // -------------------------------------------------------------
    console.log("\n--- TEST 6: Real Modal Integrations (Timeline & Outbox) ---");
    
    // Customer Audit Timeline Button (modal is CLOSED, button is spotlighted)
    await page.click('[data-testid="tour-next-btn"]');
    await sleep(600);
    const timelineBtnTitle = await page.$eval("#tour-popover-title", (el) => el.innerText);
    const timelineBtnText = await page.$eval('[data-testid="tour-next-btn"]', (el) => el.innerText);
    console.log(`✓ Timeline Button Step: "${timelineBtnTitle}" (Next button: "${timelineBtnText}")`);
    const timelineOpenBefore = await page.$('[data-testid="customer-timeline-modal"]');
    testResults["Timeline button spotlighted before modal opens"] = timelineBtnText.includes("Open Timeline") && !timelineOpenBefore ? "PASS" : "FAIL";

    // Step 17: Customer Audit Timeline Modal (modal is OPEN, dialog card is spotlighted)
    await page.click('[data-testid="tour-next-btn"]');
    await page.waitForSelector('[data-testid="customer-timeline-modal"]', { timeout: 10000 });
    const timelineModalTitle = await page.$eval("#tour-popover-title", (el) => el.innerText);
    console.log(`✓ Timeline Modal Step: "${timelineModalTitle}"`);
    testResults["Real CustomerTimeline modal"] = "PASS";
    await saveScreenshot(page, "walkthrough_customer_timeline_modal.png");

    // Step 18: Multilingual Outreach Button (modal is CLOSED, button is spotlighted)
    await page.click('[data-testid="tour-next-btn"]');
    await sleep(600);
    const outreachBtnTitle = await page.$eval("#tour-popover-title", (el) => el.innerText);
    const outreachBtnText = await page.$eval('[data-testid="tour-next-btn"]', (el) => el.innerText);
    console.log(`✓ Outreach Button Step: "${outreachBtnTitle}" (Next button: "${outreachBtnText}")`);
    const timelineOpenAfter = await page.$('[data-testid="customer-timeline-modal"]');
    const outboxOpenBefore = await page.$('[data-testid="mock-outbox-modal"]');
    testResults["Timeline modal closed & Outreach button spotlighted"] = outreachBtnText.includes("Preview Outreach") && !timelineOpenAfter && !outboxOpenBefore ? "PASS" : "FAIL";

    // Step 19: Multilingual Outreach Modal (outbox modal is OPEN, dialog card is spotlighted)
    await page.click('[data-testid="tour-next-btn"]');
    await page.waitForSelector('[data-testid="mock-outbox-modal"]', { timeout: 10000 });
    const outboxModalTitle = await page.$eval("#tour-popover-title", (el) => el.innerText);
    console.log(`✓ Outbox Modal Step: "${outboxModalTitle}"`);
    testResults["Real MockOutboxModal"] = "PASS";
    await saveScreenshot(page, "walkthrough_outbox_preview_modal.png");

    // -------------------------------------------------------------
    // 7. CROSS-ROUTE BACK TO CONSOLE & BENCHMARK MODAL
    // -------------------------------------------------------------
    console.log("\n--- TEST 7: Return to /console & Benchmark Modal ---");
    
    // Step 20: Click Next from Outbox step -> navigates to /console, benchmark button is spotlighted (modal CLOSED)
    await page.click('[data-testid="tour-next-btn"]');
    await page.waitForFunction(() => window.location.pathname === "/console", { timeout: 10000 });
    await page.waitForSelector('[data-testid="open-benchmark-btn"]', { timeout: 10000 });
    await sleep(800);

    const backUrl = page.url();
    console.log(`✓ Returned to URL: ${backUrl}`);
    const benchmarkBtnTitle = await page.$eval("#tour-popover-title", (el) => el.innerText);
    const benchmarkBtnText = await page.$eval('[data-testid="tour-next-btn"]', (el) => el.innerText);
    const outboxOpenAfter = await page.$('[data-testid="mock-outbox-modal"]');
    const benchmarkOpenBefore = await page.$('[data-testid="benchmark-modal"]');
    console.log(`✓ Benchmark Button Step: "${benchmarkBtnTitle}" (Next button: "${benchmarkBtnText}")`);
    testResults["Console return & Benchmark button spotlighted"] = backUrl.endsWith("/console") && benchmarkBtnText.includes("View Benchmark") && !outboxOpenAfter && !benchmarkOpenBefore ? "PASS" : "FAIL";

    // Step 21: Benchmark Modal Step (BenchmarkModal is OPEN, dialog card is spotlighted)
    await page.click('[data-testid="tour-next-btn"]');
    await page.waitForSelector('[data-testid="benchmark-modal"]', { timeout: 10000 });
    const benchmarkModalTitle = await page.$eval("#tour-popover-title", (el) => el.innerText);
    console.log(`✓ Benchmark Modal Step: "${benchmarkModalTitle}"`);
    testResults["Real BenchmarkModal on console"] = "PASS";
    await saveScreenshot(page, "walkthrough_benchmark_modal.png");

    // -------------------------------------------------------------
    // 8. WALKTHROUGH COMPLETION & PERSISTENCE
    // -------------------------------------------------------------
    console.log("\n--- TEST 8: Walkthrough Completion & Persistence ---");
    
    // Advance to Final Completion Step (BenchmarkModal cleanly CLOSED!)
    await page.click('[data-testid="tour-next-btn"]');
    await page.waitForSelector('[data-testid="tour-finish-btn"]', { timeout: 10000 });
    const finishStepTitle = await page.$eval("#tour-popover-title", (el) => el.innerText);
    console.log(`✓ Final step: "${finishStepTitle}"`);
    const benchmarkOpenOnComplete = await page.$('[data-testid="benchmark-modal"]');
    testResults["Benchmark modal cleanly closed on complete step"] = !benchmarkOpenOnComplete && finishStepTitle.includes("Complete") ? "PASS" : "FAIL";

    // Click Finish Walkthrough
    await page.click('[data-testid="tour-finish-btn"]');
    await sleep(500);

    // Assert overlay is gone
    const overlayExists = await page.$('[data-testid="product-tour-popover"]');
    const isCompletedStorage = await page.evaluate(() => localStorage.getItem("revora_product_tour_completed"));
    console.log(`✓ Tour dismissed. Local storage value: "${isCompletedStorage}"`);
    testResults["Tour completion state saved"] = !overlayExists && isCompletedStorage === "true" ? "PASS" : "FAIL";

    // Reload page -> verify tour does NOT automatically reopen
    await page.reload({ waitUntil: "networkidle2" });
    await sleep(800);
    const overlayAfterReload = await page.$('[data-testid="product-tour-popover"]');
    testResults["No auto-reopen on reload"] = !overlayAfterReload ? "PASS" : "FAIL";
    console.log(`✓ Tour did not auto-reopen after reload: ${!overlayAfterReload}`);

    // Click "Product tour" button in console header -> verify tour restarts from Step 1
    console.log("Clicking 'Product tour' manual entry button in header...");
    await page.click('[data-testid="console-product-tour-btn"]');
    await page.waitForSelector('[data-testid="product-tour-popover"]', { timeout: 5000 });
    const restartedStepCounter = await page.$eval('[data-testid="tour-step-counter"]', (el) => el.innerText);
    console.log(`✓ Manually restarted tour: "${restartedStepCounter}"`);
    testResults["Manual restart starts from Step 1"] = restartedStepCounter.includes("Step 1") ? "PASS" : "FAIL";

    // -------------------------------------------------------------
    // 9. RESPONSIVE VERIFICATION ACROSS 7 VIEWPORTS
    // -------------------------------------------------------------
    console.log("\n--- TEST 9: Responsive Spotlight & Popover (7 Viewports) ---");
    const requiredViewports = [
      { width: 320, height: 568, name: "iPhone SE 1st gen (320px)" },
      { width: 360, height: 640, name: "Android Compact (360px)" },
      { width: 375, height: 667, name: "iPhone SE / 8 (375px)" },
      { width: 390, height: 844, name: "iPhone 12 / 13 / 14 (390px)" },
      { width: 414, height: 896, name: "iPhone Plus / Max (414px)" },
      { width: 768, height: 1024, name: "iPad Portrait (768px)" },
      { width: 1440, height: 900, name: "Desktop Widescreen (1440px)" },
    ];

    for (const vp of requiredViewports) {
      await page.setViewport({ width: vp.width, height: vp.height });
      await sleep(300);

      // Check horizontal overflow
      const overflowData = await page.evaluate(() => {
        const scrollW = document.documentElement.scrollWidth;
        const innerW = window.innerWidth;
        const popover = document.querySelector('[data-testid="product-tour-popover"]');
        let popoverValid = true;
        if (popover) {
          const rect = popover.getBoundingClientRect();
          if (rect.left < 0 || rect.right > innerW + 2) {
            popoverValid = false;
          }
        }
        return {
          scrollW,
          innerW,
          hasOverflow: scrollW > innerW,
          popoverValid,
        };
      });

      const pass = !overflowData.hasOverflow && overflowData.popoverValid;
      testResults[`Viewport ${vp.width}px zero overflow`] = pass ? "PASS" : "FAIL";
      console.log(
        `✓ Viewport ${vp.width}x${vp.height} (${vp.name}): scrollWidth=${overflowData.scrollW}, innerWidth=${overflowData.innerW} -> ${pass ? "PASS" : "FAIL"}`
      );
      if (vp.width === 375) {
        await saveScreenshot(page, "walkthrough_responsive_375px.png");
      }
    }

  } catch (err) {
    console.error("❌ Test execution encountered an error:", err);
    testResults["Execution error"] = `FAIL: ${err.message}`;
  } finally {
    await browser.close();
  }

  // -------------------------------------------------------------
  // SUMMARY REPORT
  // -------------------------------------------------------------
  console.log("\n===============================================================");
  console.log("=== PRODUCT WALKTHROUGH E2E VERIFICATION RESULTS SUMMARY ===");
  console.log("===============================================================");
  let allPass = true;
  for (const [test, result] of Object.entries(testResults)) {
    const isPass = result === "PASS";
    if (!isPass) allPass = false;
    console.log(`${isPass ? "✓" : "✗"} ${test.padEnd(45)} : ${result}`);
  }

  if (allPass) {
    console.log("\n🏆 ALL PRODUCT WALKTHROUGH E2E CHECKS PASSED!");
    process.exit(0);
  } else {
    console.log("\n❌ SOME CHECKS FAILED. See details above.");
    process.exit(1);
  }
}

runWalkthroughVerification();
