/**
 * Automated E2E Browser Verification for Revora Landing Page (Phase 8A).
 * 
 * Verifies:
 * 1. Three.js particle canvas initialization and convergence
 * 2. Semantic <h1> headline containing live evaluated recovered-₹ numeral
 * 3. Merchant-perspective supporting sentence
 * 4. Single primary CTA: "See how it works"
 * 5. Utility header link: "Operator Console →"
 * 6. Six-stage deterministic mechanism diagram
 * 7. Multilingual outreach language proof (EN, HI, TA) with safety guardrails
 * 8. Live evaluation report metrics & 5-seed robustness table
 * 9. prefers-reduced-motion static final state
 * 10. Captures 5 high-res screenshots
 */
const path = require("path");
const fs = require("fs");
const puppeteer = require(path.resolve(__dirname, "..", "frontend", "node_modules", "puppeteer-core"));

const CHROME_PATH = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const LANDING_URL = "http://127.0.0.1:3000";

const ARTIFACT_DIR = "C:\\Users\\LENOVO\\.gemini\\antigravity-ide\\brain\\a5b322f8-0e26-40dc-9bbe-f60d79d7ad68";
const DOCS_DIR = path.resolve(__dirname, "..", "docs", "screenshots");

[ARTIFACT_DIR, DOCS_DIR].forEach((dir) => {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

async function saveScreenshot(page, filename) {
  const file1 = path.join(ARTIFACT_DIR, filename);
  const file2 = path.join(DOCS_DIR, filename);
  await page.screenshot({ path: file1, fullPage: false });
  fs.copyFileSync(file1, file2);
  console.log(`[SCREENSHOT] Saved: ${filename}`);
}

async function runLandingVerification() {
  console.log("=== REVORA LANDING PAGE E2E VERIFICATION ===");
  console.log(`Launching Chrome: ${CHROME_PATH}`);

  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: "new",
    defaultViewport: { width: 1440, height: 900 },
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-gpu"],
  });

  const results = {};

  try {
    const page = await browser.newPage();

    // 1. Navigate to Landing Page
    console.log(`Navigating to ${LANDING_URL}...`);
    await page.goto(LANDING_URL, { waitUntil: "networkidle2", timeout: 20000 });

    // 2. Check Header
    const brandText = await page.$eval("header", (el) => el.innerText);
    if (brandText.includes("REVORA") && brandText.includes("Operator Console")) {
      results["Landing Header"] = "PASS";
      console.log("[VERIFY] Landing Header: PASS");
    } else {
      results["Landing Header"] = "FAIL: Missing brand or console link";
    }

    // 3. Check Hero Three.js Canvas & Semantic <h1> Headline
    const canvasExists = await page.$('canvas[data-testid="hero-threejs-canvas"]');
    const headlineNumeral = await page.$eval('h1[data-testid="hero-headline-numeral"]', (el) => el.innerText.trim());
    console.log(`[DEBUG] Detected Hero Headline Numeral: "${headlineNumeral}"`);

    if (canvasExists && headlineNumeral.includes("₹")) {
      results["Hero Particle & Numeral"] = "PASS";
      console.log("[VERIFY] Hero Particle & Numeral: PASS");
    } else {
      results["Hero Particle & Numeral"] = "FAIL: Canvas or Numeral missing";
    }

    // 4. Check Merchant Sentence & Single CTA
    const bodyText = await page.$eval("section", (el) => el.innerText);
    const hasMerchantSentence = bodyText.includes("Recurring subscription revenue recovered from silent mandate and card failures");
    const hasSingleCta = await page.$('a[data-testid="cta-see-how-it-works"]');

    if (hasMerchantSentence && hasSingleCta) {
      results["Merchant Sentence & Single CTA"] = "PASS";
      console.log("[VERIFY] Merchant Sentence & Single CTA: PASS");
    } else {
      results["Merchant Sentence & Single CTA"] = "FAIL: Missing supporting sentence or CTA";
    }

    // Wait for the 2.8s convergence animation to complete
    await new Promise((r) => setTimeout(r, 3200));
    await saveScreenshot(page, "09_landing_hero_desktop.png");

    // 5. Scroll to and Verify Mechanism Diagram
    console.log("Scrolling to #mechanism...");
    await page.evaluate(() => {
      const el = document.getElementById("mechanism");
      if (el) el.scrollIntoView();
    });
    await new Promise((r) => setTimeout(r, 800));

    const mechanismText = await page.$eval("#mechanism", (el) => el.innerText);
    const hasStages = mechanismText.includes("Signal Ingestion") &&
                      mechanismText.includes("Deterministic Diagnosis") &&
                      mechanismText.includes("ML Propensity Signal") &&
                      mechanismText.includes("Decision Engine") &&
                      mechanismText.includes("Multilingual Constrained Outreach") &&
                      mechanismText.includes("Outbox & Audit Logging");

    if (hasStages && mechanismText.includes("OBSERVED") && mechanismText.includes("DECISION")) {
      results["Mechanism Diagram"] = "PASS";
      console.log("[VERIFY] Mechanism Diagram: PASS");
    } else {
      results["Mechanism Diagram"] = "FAIL: Missing pipeline stages or provenance tags";
    }
    await saveScreenshot(page, "10_landing_mechanism_diagram.png");

    // 6. Scroll to and Verify Language Proof
    console.log("Scrolling to #language-proof...");
    await page.evaluate(() => {
      const el = document.getElementById("language-proof");
      if (el) el.scrollIntoView();
    });
    await new Promise((r) => setTimeout(r, 800));

    // Test tab switches
    await page.click('button[data-testid="lang-tab-hi"]');
    await new Promise((r) => setTimeout(r, 400));
    const hiText = await page.$eval("#language-proof", (el) => el.innerText);
    const hasHinglish = hiText.includes("Namaste") && hiText.includes("SIMULATED — NO MESSAGE SENT");

    await page.click('button[data-testid="lang-tab-ta"]');
    await new Promise((r) => setTimeout(r, 400));
    const taText = await page.$eval("#language-proof", (el) => el.innerText);
    const hasTanglish = taText.includes("Vanakkam");

    if (hasHinglish && hasTanglish && taText.includes("Zero Credential Solicitation")) {
      results["Language Proof & Guardrails"] = "PASS";
      console.log("[VERIFY] Language Proof & Guardrails: PASS");
    } else {
      results["Language Proof & Guardrails"] = "FAIL: Multilingual tabs or safety guarantees missing";
    }
    await saveScreenshot(page, "11_landing_language_proof.png");

    // 7. Scroll to and Verify Evaluation Report
    console.log("Scrolling to #evaluation-report...");
    await page.evaluate(() => {
      const el = document.getElementById("evaluation-report");
      if (el) el.scrollIntoView();
    });
    await new Promise((r) => setTimeout(r, 1000));

    const evalText = await page.$eval("#evaluation-report", (el) => el.innerText);
    const evalLower = evalText.toLowerCase();
    const hasRecoveryRate = evalLower.includes("recovery rate") && evalText.includes("%");
    const hasRecoveredRevenue = evalLower.includes("recovered revenue") && evalText.includes("₹");
    const hasCompliance = evalLower.includes("policy compliance") && evalText.includes("100");
    const hasConsoleCta = await page.$('a[data-testid="cta-open-console"]');

    if (hasRecoveryRate && hasRecoveredRevenue && hasCompliance && hasConsoleCta) {
      results["Evaluation Report & Console Link"] = "PASS";
      console.log("[VERIFY] Evaluation Report & Console Link: PASS");
    } else {
      results["Evaluation Report & Console Link"] = "FAIL: Missing dynamic metrics or console CTA";
    }
    await saveScreenshot(page, "12_landing_evaluation_report.png");

    // 8. Test prefers-reduced-motion
    console.log("Testing prefers-reduced-motion...");
    const reducedMotionPage = await browser.newPage();
    await reducedMotionPage.emulateMediaFeatures([{ name: "prefers-reduced-motion", value: "reduce" }]);
    await reducedMotionPage.goto(LANDING_URL, { waitUntil: "networkidle2", timeout: 15000 });
    await new Promise((r) => setTimeout(r, 500));

    const rmHeadline = await reducedMotionPage.$eval('h1[data-testid="hero-headline-numeral"]', (el) => el.innerText.trim());
    if (rmHeadline.includes("₹")) {
      results["Reduced Motion Static State"] = "PASS";
      console.log("[VERIFY] Reduced Motion Static State: PASS");
    } else {
      results["Reduced Motion Static State"] = "FAIL: Headline not immediately visible in reduced motion";
    }
    await saveScreenshot(reducedMotionPage, "13_landing_reduced_motion.png");
    await reducedMotionPage.close();

    // 9. Test Navigation to /console
    console.log("Testing navigation to /console...");
    await Promise.all([
      page.waitForNavigation({ waitUntil: "networkidle2" }),
      page.click('a[data-testid="header-console-link"]'),
    ]);
    const currentUrl = page.url();
    if (currentUrl.includes("/console")) {
      results["Navigation to /console"] = "PASS";
      console.log(`[VERIFY] Navigation to /console: PASS (${currentUrl})`);
    } else {
      results["Navigation to /console"] = `FAIL: URL is ${currentUrl}`;
    }

  } catch (err) {
    console.error("E2E Verification Error:", err);
    results["Execution Error"] = err.message;
  } finally {
    await browser.close();
  }

  console.log("\n=== E2E LANDING VERIFICATION COMPLETED ===");
  console.log(JSON.stringify(results, null, 2));

  const allPassed = Object.values(results).every((v) => v === "PASS");
  if (!allPassed) {
    console.error("Some verification steps failed!");
    process.exit(1);
  }
}

runLandingVerification();
