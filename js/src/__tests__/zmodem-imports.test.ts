import { describe, expect, it } from "vitest";
import { Browser } from "zmodem.js/src/zmodem_browser";
import * as zmodemRoot from "zmodem.js";

// Regression tests for #136.
//
// The ZMODEM browser helpers (the ones that write a received file to disk and
// send a local file to the peer) live on the `zmodem.js/src/zmodem_browser`
// subpath. The package root does NOT re-export `Browser`:
//
//     Object.assign(module.exports, require("./src/zsentry"));
//
// so `import { Browser } from "zmodem.js"` yields `undefined`, and every
// transfer fails at runtime with "Browser.save_to_disk is not a function"
// (see #136, fixed in #167). These tests pin both halves of that contract so a
// future edit cannot quietly reintroduce the bad import.
describe("zmodem.js Browser helpers", () => {
  it("exposes save_to_disk and send_files on the src/zmodem_browser subpath", () => {
    expect(Browser).toBeTruthy();
    expect(typeof Browser.save_to_disk).toBe("function");
    expect(typeof Browser.send_files).toBe("function");
  });

  it("does not expose the Browser helpers from the package root", () => {
    // If this ever starts passing with a truthy value, the import in
    // zmodem.tsx could safely move to the root; until then it must not.
    expect((zmodemRoot as Record<string, unknown>).Browser).toBeUndefined();
  });
});
