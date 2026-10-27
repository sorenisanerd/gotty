import { existsSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { devices, expect, Page, test } from "@playwright/test";

// Drives the mobile key strip on an emulated phone against the real gotty and
// shell. As in zmodem.spec.ts, outcomes are files the shell writes, not
// terminal text scraped from the canvas.
const SCRATCH = "/tmp/gotty-e2e";

async function typeLine(page: Page, text: string) {
  await page.keyboard.type(text);
  await page.keyboard.press("Enter");
}

async function waitForFileContent(path: string, expected: string, timeout = 15_000) {
  const deadline = Date.now() + timeout;
  let last = "";
  while (Date.now() < deadline) {
    try {
      last = readFileSync(path, "utf8");
      if (last === expected) return;
    } catch {
      // Not created yet.
    }
    await new Promise((r) => setTimeout(r, 200));
  }
  throw new Error(
    `Timed out waiting for ${path} to contain ${JSON.stringify(expected)}; last read ${JSON.stringify(last)}`,
  );
}

// Headless Chromium has no on-screen keyboard. Stand in for the visual
// viewport before the page's scripts run, so a test can shrink it the way an
// opening phone keyboard does.
async function fakeVisualViewport(page: Page) {
  await page.addInitScript(() => {
    const vv = new EventTarget() as any;
    let shrink = 0;
    Object.defineProperty(vv, "height", { get: () => innerHeight - shrink });
    Object.defineProperty(vv, "offsetTop", { get: () => 0 });
    Object.defineProperty(vv, "scale", { get: () => 1 });
    Object.defineProperty(window, "visualViewport", { value: vv, configurable: true });
    (window as any).__openKeyboard = () => {
      shrink = 300;
      vv.dispatchEvent(new Event("resize"));
    };
  });
}

// Open the page, wait until the shell is live, then "open the keyboard".
async function openTerminalWithKeyboard(page: Page) {
  await fakeVisualViewport(page);
  await page.goto("/");
  await expect(page.locator(".xterm")).toBeVisible();
  await page.locator(".xterm").tap();
  // Keys sent before the WebSocket and shell are up are dropped, so retry the
  // (idempotent) setup line until the shell has run it.
  await expect
    .poll(
      async () => {
        await typeLine(page, `mkdir -p ${SCRATCH} && cd ${SCRATCH} && touch mk-ready`);
        return existsSync(`${SCRATCH}/mk-ready`);
      },
      { timeout: 20_000, intervals: [500, 1_000] },
    )
    .toBe(true);
  await page.evaluate(() => (window as any).__openKeyboard());
  await expect(page.locator("#gotty-mobile-keys")).toBeVisible();
}

function stripKey(page: Page, name: string) {
  return page.locator(`#gotty-mobile-keys [data-key="${name}"]`);
}

test.beforeEach(() => {
  if (!existsSync(SCRATCH)) return;
  for (const f of readdirSync(SCRATCH)) {
    if (f.startsWith("mk-")) rmSync(`${SCRATCH}/${f}`, { force: true });
  }
});

test.describe("mobile key strip", () => {
  test("Tab completes a command", async ({ page }) => {
    await openTerminalWithKeyboard(page);
    await page.keyboard.type("ech");
    await stripKey(page, "Tab").tap();
    await typeLine(page, `tabok > ${SCRATCH}/mk-tab`);
    await waitForFileContent(`${SCRATCH}/mk-tab`, "tabok\n");
  });

  test("Up recalls the previous command", async ({ page }) => {
    await openTerminalWithKeyboard(page);
    await typeLine(page, "echo first");
    await stripKey(page, "Up").tap();
    await typeLine(page, ` > ${SCRATCH}/mk-up`);
    await waitForFileContent(`${SCRATCH}/mk-up`, "first\n");
  });

  test("Ctrl applies to the next key typed on the keyboard", async ({ page }) => {
    await openTerminalWithKeyboard(page);
    await typeLine(page, "sleep 30");
    await stripKey(page, "Ctrl").tap();
    await page.keyboard.type("c");
    await typeLine(page, `echo ctrl > ${SCRATCH}/mk-ctrl`);
    // Without Ctrl-C the shell would still be sleeping.
    await waitForFileContent(`${SCRATCH}/mk-ctrl`, "ctrl\n", 5_000);
  });

  test("asks the on-screen keyboard not to autocorrect or suggest", async ({ page }) => {
    await page.goto("/");
    const input = page.locator(".xterm-helper-textarea");
    await expect(input).toHaveAttribute("autocomplete", "off");
    await expect(input).toHaveAttribute("autocorrect", "off");
    await expect(input).toHaveAttribute("autocapitalize", "off");
    await expect(input).toHaveAttribute("spellcheck", "false");
  });

  test("leaves IME composition working", async ({ page }) => {
    await openTerminalWithKeyboard(page);
    await page.evaluate(() => {
      (window as any).__compositions = 0;
      document.querySelector(".xterm-helper-textarea")!
        .addEventListener("compositionstart", () => { (window as any).__compositions++; });
    });
    // Compose a word the way an on-screen keyboard's IME does, then commit it.
    const cdp = await page.context().newCDPSession(page);
    await cdp.send("Input.imeSetComposition", { text: "ech", selectionStart: 3, selectionEnd: 3 });
    await cdp.send("Input.imeSetComposition", { text: "echo", selectionStart: 4, selectionEnd: 4 });
    await cdp.send("Input.insertText", { text: "echo" });
    expect(await page.evaluate(() => (window as any).__compositions)).toBeGreaterThan(0);
    await typeLine(page, ` ime > ${SCRATCH}/mk-ime`);
    await waitForFileContent(`${SCRATCH}/mk-ime`, "ime\n");
  });

  for (const [label, viewport] of [
    ["a desktop browser", { width: 1280, height: 720 }],
    ["a narrow desktop window", { width: 375, height: 667 }],
  ] as const) {
    test(`is not shown on ${label}`, async ({ browser, baseURL }) => {
      const { defaultBrowserType, ...desktop } = devices["Desktop Chrome"];
      const context = await browser.newContext({ ...desktop, viewport, baseURL });
      const page = await context.newPage();
      await page.goto("/");
      await expect(page.locator(".xterm")).toBeVisible();
      await expect(page.locator("#gotty-mobile-keys")).toHaveCount(0);
      // The display settings button stays where it always was.
      await expect(page.locator("#gotty-theme-btn")).toHaveCSS("bottom", "12px");
      await context.close();
    });
  }
});
