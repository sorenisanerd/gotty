import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent } from "@testing-library/preact";
import { initThemePicker } from "../theme-picker";

// The picker probes for a font by measuring a sample against two different
// fallbacks. jsdom has no canvas, so emulate that rule: a font listed in
// `available` overrides both fallbacks (equal widths); anything else falls
// back to each separately (differing widths).
function mockCanvas(available: string[]) {
  const ctx = {
    font: "",
    measureText() {
      const font = this.font;
      const overridden = available.some((f) => font.includes(`'${f}'`));
      return { width: !overridden && font.includes("serif") ? 100 : 50 };
    },
  };
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(ctx as any);
}

function makeTerm() {
  return { options: { fontSize: 14, fontFamily: "monospace" } } as any;
}

// The refit is scheduled across animation frames; wait long enough for two
// frames whether the environment uses rAF or the setTimeout fallback.
const flushFrames = () => new Promise((resolve) => setTimeout(resolve, 60));

const THEMES = { default: { background: "#101010" }, nord: { background: "#2e3440" } };

function familyItem(name: string): HTMLElement {
  return [...document.querySelectorAll<HTMLElement>(".font-family-item")].find(
    (el) => el.querySelector(".font-family-preview")?.textContent === name,
  )!;
}

beforeEach(() => {
  document.body.innerHTML = "";
  document.head.querySelectorAll("style").forEach((s) => s.remove());
  localStorage.clear();
  vi.restoreAllMocks();
  (window as any).gotty_themes = THEMES;
});

describe("font family availability", () => {
  it("marks fonts that are not installed and leaves them unselectable", () => {
    mockCanvas(["DejaVu Sans Mono"]);
    const term = makeTerm();
    initThemePicker(term);

    expect(familyItem("DejaVu Sans Mono").classList.contains("unavailable")).toBe(false);
    const missing = familyItem("JetBrains Mono");
    expect(missing.classList.contains("unavailable")).toBe(true);
    expect(missing.textContent).toContain("not installed");

    fireEvent.click(missing);

    expect(term.options.fontFamily).toBe("monospace");
    expect(localStorage.getItem("gotty-font-family")).toBeNull();
  });

  it("applies an installed font and re-fits", async () => {
    mockCanvas(["DejaVu Sans Mono"]);
    const term = makeTerm();
    const refit = vi.fn();
    initThemePicker(term, refit);

    fireEvent.click(familyItem("DejaVu Sans Mono"));

    expect(term.options.fontFamily).toBe("'DejaVu Sans Mono', monospace");
    expect(localStorage.getItem("gotty-font-family")).toBe("'DejaVu Sans Mono', monospace");

    await flushFrames();
    expect(refit).toHaveBeenCalledTimes(1);
  });

  it("treats the always-available generic keywords as selectable", () => {
    mockCanvas([]);
    const term = makeTerm();
    initThemePicker(term);

    expect(familyItem("monospace").classList.contains("unavailable")).toBe(false);
    expect(familyItem("serif").classList.contains("unavailable")).toBe(false);
  });
});

describe("re-fit after a font change", () => {
  it("re-fits after a font size change", async () => {
    mockCanvas([]);
    const term = makeTerm();
    const refit = vi.fn();
    initThemePicker(term, refit);

    const size24 = [...document.querySelectorAll<HTMLElement>(".size-btn")].find(
      (el) => el.textContent === "24",
    )!;
    fireEvent.click(size24);

    expect(term.options.fontSize).toBe(24);
    expect(localStorage.getItem("gotty-font-size")).toBe("24");

    await flushFrames();
    expect(refit).toHaveBeenCalledTimes(1);
  });

  it("re-fits on load when a saved preference is restored", async () => {
    mockCanvas([]);
    localStorage.setItem("gotty-font-size", "20");
    const term = makeTerm();
    const refit = vi.fn();
    initThemePicker(term, refit);

    expect(term.options.fontSize).toBe(20);

    await flushFrames();
    expect(refit).toHaveBeenCalledTimes(1);
  });

  it("does not re-fit on load when nothing was restored", async () => {
    mockCanvas([]);
    const refit = vi.fn();
    initThemePicker(makeTerm(), refit);

    await flushFrames();
    expect(refit).not.toHaveBeenCalled();
  });
});
