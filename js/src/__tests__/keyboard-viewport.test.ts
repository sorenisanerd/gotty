import { afterEach, describe, expect, it, vi } from "vitest";
import { computeVisibleArea, watchVisibleArea } from "../keyboard-viewport";

// A stand-in for window.visualViewport whose size the test controls.
function fakeViewport(height: number, offsetTop = 0) {
  const vv = new EventTarget() as EventTarget & { height: number; offsetTop: number; scale: number };
  vv.height = height;
  vv.offsetTop = offsetTop;
  vv.scale = 1;
  return vv;
}

function setInnerHeight(h: number) {
  Object.defineProperty(window, "innerHeight", { value: h, configurable: true });
}

afterEach(() => {
  document.body.innerHTML = "";
  setInnerHeight(768);
});

describe("computeVisibleArea", () => {
  it("reports an open keyboard when focused and the viewport shrank a lot", () => {
    expect(computeVisibleArea(800, { height: 450, offsetTop: 0, scale: 1 }, true)).toEqual({
      keyboardOpen: true,
      top: 0,
      height: 450,
      bottomInset: 350,
    });
  });

  it("never reports a keyboard while the terminal is not focused", () => {
    expect(computeVisibleArea(800, { height: 450, offsetTop: 0, scale: 1 }, false).keyboardOpen).toBe(false);
  });

  it("ignores a small shrink such as the URL bar", () => {
    expect(computeVisibleArea(800, { height: 700, offsetTop: 0, scale: 1 }, true).keyboardOpen).toBe(false);
  });

  it("does not mistake pinch-zoom for a keyboard", () => {
    expect(computeVisibleArea(800, { height: 400, offsetTop: 0, scale: 2 }, true).keyboardOpen).toBe(false);
  });

  it("still sees the keyboard while zoomed in", () => {
    expect(computeVisibleArea(800, { height: 225, offsetTop: 0, scale: 2 }, true).keyboardOpen).toBe(true);
  });

  it("accounts for a panned viewport", () => {
    const area = computeVisibleArea(800, { height: 450, offsetTop: 120, scale: 1 }, true);
    expect(area.top).toBe(120);
    expect(area.bottomInset).toBe(230);
  });
});

describe("watchVisibleArea", () => {
  function setup() {
    setInnerHeight(800);
    const input = document.createElement("textarea");
    document.body.appendChild(input);
    const vv = fakeViewport(800);
    const onChange = vi.fn();
    const stop = watchVisibleArea(input, vv as unknown as VisualViewport, onChange);
    return { input, vv, onChange, stop };
  }

  it("reports the keyboard opening and closing", () => {
    const { input, vv, onChange } = setup();
    input.focus();
    vv.height = 450;
    vv.dispatchEvent(new Event("resize"));
    expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({ keyboardOpen: true, height: 450 }));

    input.blur();
    expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({ keyboardOpen: false }));
  });

  it("keeps the keyboard closed for a hardware keyboard (focused, no shrink)", () => {
    const { input, onChange } = setup();
    input.focus();
    expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({ keyboardOpen: false }));
  });

  it("stops reporting after unsubscribing", () => {
    const { input, vv, onChange, stop } = setup();
    stop();
    input.focus();
    vv.dispatchEvent(new Event("resize"));
    vv.dispatchEvent(new Event("scroll"));
    expect(onChange).not.toHaveBeenCalled();
  });
});
