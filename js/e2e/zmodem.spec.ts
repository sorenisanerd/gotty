import { existsSync, readFileSync } from "node:fs";
import { expect, Page, test } from "@playwright/test";

// These tests exercise the real browser <-> gotty <-> shell path. The terminal
// is rendered to a canvas, so instead of scraping terminal text we assert on
// filesystem side effects: every interesting outcome is a file that either
// appears, transfers, or fails to appear.
const SCRATCH = "/tmp/gotty-e2e";

async function focusTerminal(page: Page) {
  await page.locator(".xterm").click();
  await page.keyboard.press("Space");
  await page.keyboard.press("Backspace");
}

async function typeLine(page: Page, text: string) {
  await page.keyboard.type(text);
  await page.keyboard.press("Enter");
}

async function waitForFile(path: string, timeout = 15_000) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    if (existsSync(path)) return;
    await new Promise((r) => setTimeout(r, 200));
  }
  throw new Error(`Timed out waiting for ${path} to exist`);
}

// Open the page, wait for the terminal, and land in a clean scratch directory.
async function openTerminal(page: Page) {
  await page.goto("/");
  await expect(page.locator(".xterm")).toBeVisible();
  await focusTerminal(page);
  // The canvas can be visible before the WebSocket/shell is live, and keys sent
  // too early are dropped. Retry the (idempotent) setup line until the shell
  // has actually run it. The scratch dir is wiped so no marker from a previous
  // run can satisfy a later assertion.
  await expect
    .poll(
      async () => {
        await typeLine(
          page,
          `rm -rf ${SCRATCH}; mkdir -p ${SCRATCH}; cd ${SCRATCH} && touch ready.marker`,
        );
        return existsSync(`${SCRATCH}/ready.marker`);
      },
      { timeout: 20_000, intervals: [500, 1_000] },
    )
    .toBe(true);
}

test.describe("zmodem file transfer", () => {
  test("rz uploads a file to the server", async ({ page }) => {
    await openTerminal(page);

    await typeLine(page, "rz");
    const modal = page.locator(".modal.show");
    await expect(modal).toContainText("Send file");

    await page.setInputFiles('input[type="file"]', {
      name: "uploaded.txt",
      mimeType: "text/plain",
      buffer: Buffer.from("hello from playwright\n"),
    });
    await modal.getByRole("button", { name: "Send" }).click();

    await waitForFile(`${SCRATCH}/uploaded.txt`);
    expect(readFileSync(`${SCRATCH}/uploaded.txt`, "utf8")).toBe(
      "hello from playwright\n",
    );
  });

  test("sz downloads a file to the browser", async ({ page }) => {
    await openTerminal(page);
    await typeLine(page, "printf 'download-payload\\n' > dl.txt");

    const downloadPromise = page.waitForEvent("download");
    await typeLine(page, "sz dl.txt");

    const modal = page.locator(".modal.show");
    await expect(modal).toContainText("Incoming file");
    await modal.getByRole("button", { name: "Accept" }).click();

    const download = await downloadPromise;
    expect(download.suggestedFilename()).toBe("dl.txt");
    const path = await download.path();
    expect(readFileSync(path, "utf8")).toContain("download-payload");
  });

  test("dismissing the rz dialog does not freeze the terminal", async ({
    page,
  }) => {
    await openTerminal(page);

    await typeLine(page, "rz");
    const modal = page.locator(".modal.show");
    await expect(modal).toContainText("Send file");

    // Close via the X button (one of the dismiss paths that used to hang).
    await modal.locator(".btn-close").click();
    await expect(modal).toBeHidden();

    // If stdin were still disabled, this command would never reach the shell.
    // Measured: ~0.5s with the dismiss fix, and never without it.
    await expect
      .poll(
        async () => {
          await typeLine(page, "touch unfrozen.marker");
          return existsSync(`${SCRATCH}/unfrozen.marker`);
        },
        { timeout: 6_000, intervals: [500] },
      )
      .toBe(true);
  });

  test("dismissing the sz dialog does not freeze the terminal", async ({
    page,
  }) => {
    await openTerminal(page);

    await typeLine(page, "printf 'x' > dl.txt; sz dl.txt");
    const modal = page.locator(".modal.show");
    await expect(modal).toContainText("Incoming file");

    await modal.locator(".btn-close").click();
    await expect(modal).toBeHidden();

    await expect
      .poll(
        async () => {
          await typeLine(page, "touch unfrozen-sz.marker");
          return existsSync(`${SCRATCH}/unfrozen-sz.marker`);
        },
        { timeout: 6_000, intervals: [500] },
      )
      .toBe(true);
  });
});
