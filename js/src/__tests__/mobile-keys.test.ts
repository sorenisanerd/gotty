import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createEvent, fireEvent } from "@testing-library/preact";
import { initMobileKeys, MobileKeys } from "../mobile-keys";

const ROW1 = ["Esc", "/", "-", "|", "Home", "Up", "End", "PgUp"];
const ROW2 = ["Tab", "Ctrl", "Alt", "Shift", "Left", "Down", "Right", "PgDn"];

// A host whose term.input behaves like xterm's: it fires onData, which runs
// the installed transformer, and what comes out is what reaches the server.
function makeHost() {
  let transformer: ((data: string) => string) | null = null;
  const sent: string[] = [];
  const textarea = document.createElement("textarea");
  const elem = document.createElement("div");
  document.body.append(elem, textarea);
  const host = {
    elem,
    term: {
      input: vi.fn((data: string) => { sent.push(transformer ? transformer(data) : data); }),
      modes: { applicationCursorKeysMode: false },
      textarea,
    } as any,
    fit: vi.fn(),
    // GoTTYXterm also has refit(), which scrolls to the bottom; the strip
    // must never use it.
    refit: vi.fn(),
    setInputTransformer: vi.fn((fn: ((data: string) => string) | null) => { transformer = fn; }),
  };
  return { host, sent };
}

function stubTouchDevice(coarse: boolean) {
  window.matchMedia = vi.fn().mockReturnValue({ matches: coarse }) as any;
  const vv = new EventTarget() as any;
  vv.height = window.innerHeight;
  vv.offsetTop = 0;
  vv.scale = 1;
  Object.defineProperty(window, "visualViewport", { value: vv, configurable: true });
  return vv;
}

function key(name: string): HTMLElement {
  return document.querySelector<HTMLElement>(`#gotty-mobile-keys [data-key="${name}"]`)!;
}

function tap(name: string) {
  fireEvent.touchStart(key(name));
  fireEvent.touchEnd(key(name));
}

function setup() {
  const vv = stubTouchDevice(true);
  const { host, sent } = makeHost();
  const keys = initMobileKeys(host, true) as MobileKeys;
  return { host, sent, keys, vv };
}

beforeEach(() => {
  document.body.innerHTML = "";
  document.head.querySelectorAll("style").forEach((s) => s.remove());
  document.documentElement.style.removeProperty("--gotty-bottom-inset");
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("initMobileKeys", () => {
  it("does nothing when disabled by the server", () => {
    stubTouchDevice(true);
    const { host } = makeHost();
    expect(initMobileKeys(host, false)).toBeNull();
    expect(document.getElementById("gotty-mobile-keys")).toBeNull();
    expect(host.setInputTransformer).not.toHaveBeenCalled();
  });

  it("does nothing on a device without a coarse pointer", () => {
    stubTouchDevice(false);
    const { host } = makeHost();
    expect(initMobileKeys(host, true)).toBeNull();
    expect(document.getElementById("gotty-mobile-keys")).toBeNull();
    expect(host.setInputTransformer).not.toHaveBeenCalled();
  });

  it("sets up on the first touch of the terminal when the pointer is not coarse, e.g. a convertible", () => {
    stubTouchDevice(false);
    const { host } = makeHost();
    initMobileKeys(host, true);
    fireEvent.touchStart(host.elem);
    expect(document.querySelectorAll("#gotty-mobile-keys")).toHaveLength(1);
    expect(host.setInputTransformer).toHaveBeenCalledTimes(1);
    fireEvent.touchStart(host.elem);
    expect(document.querySelectorAll("#gotty-mobile-keys")).toHaveLength(1);
    expect(host.setInputTransformer).toHaveBeenCalledTimes(1);
  });

  it("renders two rows of eight keys in order, hidden at first", () => {
    const { keys } = setup();
    const rows = [...keys.element.querySelectorAll(".gotty-mk-row")].map((row) =>
      [...row.querySelectorAll<HTMLElement>("button.gotty-mk-key")].map((b) => b.dataset.key),
    );
    expect(rows).toEqual([ROW1, ROW2]);
    expect(keys.element.hidden).toBe(true);
  });
});

describe("special keys", () => {
  it("sends Esc", () => {
    const { sent } = setup();
    tap("Esc");
    expect(sent).toEqual(["\x1b"]);
  });

  it("sends the application-mode arrow when the terminal asks for it", () => {
    const { host, sent } = setup();
    host.term.modes.applicationCursorKeysMode = true;
    tap("Up");
    expect(sent).toEqual(["\x1bOA"]);
  });

  it("only ever reaches the terminal through term.input", () => {
    const { host } = setup();
    for (const name of [...ROW1, ...ROW2]) tap(name);
    expect(host.fit).not.toHaveBeenCalled();
    expect(host.refit).not.toHaveBeenCalled();
    expect(host.setInputTransformer).toHaveBeenCalledTimes(1);
  });
});

describe("modifiers", () => {
  it("arms Ctrl for the next phone-keyboard character, then disarms", () => {
    const { keys } = setup();
    tap("Ctrl");
    expect(key("Ctrl").classList.contains("armed")).toBe(true);
    expect(key("Ctrl").getAttribute("aria-pressed")).toBe("true");
    expect(keys.transformInput("c")).toBe("\x03");
    expect(key("Ctrl").classList.contains("armed")).toBe(false);
    expect(keys.transformInput("c")).toBe("c");
  });

  it("cancels an armed modifier when tapped again", () => {
    const { keys } = setup();
    tap("Ctrl");
    tap("Ctrl");
    expect(key("Ctrl").classList.contains("armed")).toBe(false);
    expect(keys.transformInput("c")).toBe("c");
  });

  it("applies to strip special keys", () => {
    const { sent } = setup();
    tap("Ctrl");
    tap("Left");
    expect(sent).toEqual(["\x1b[1;5D"]);
    expect(key("Ctrl").classList.contains("armed")).toBe(false);
  });

  it("makes Shift+Tab a back-tab", () => {
    const { sent } = setup();
    tap("Shift");
    tap("Tab");
    expect(sent).toEqual(["\x1b[Z"]);
  });

  it("applies to strip characters", () => {
    const { sent } = setup();
    tap("Alt");
    tap("|");
    expect(sent).toEqual(["\x1b|"]);
  });

  it("passes a multi-character chunk through untouched and disarms", () => {
    const { keys } = setup();
    tap("Ctrl");
    expect(keys.transformInput("hello")).toBe("hello");
    expect(key("Ctrl").classList.contains("armed")).toBe(false);
  });

  it("disarms when the strip is hidden", () => {
    const { keys } = setup();
    keys.setVisible(true);
    tap("Ctrl");
    keys.setVisible(false);
    expect(key("Ctrl").classList.contains("armed")).toBe(false);
    expect(keys.transformInput("c")).toBe("c");
  });
});

describe("touch handling", () => {
  it("keeps focus on the terminal by cancelling touchstart and mousedown", () => {
    setup();
    const touch = createEvent.touchStart(key("Esc"));
    fireEvent(key("Esc"), touch);
    expect(touch.defaultPrevented).toBe(true);
    const mouse = createEvent.mouseDown(key("Esc"));
    fireEvent(key("Esc"), mouse);
    expect(mouse.defaultPrevented).toBe(true);
  });

  it("repeats an arrow while held", () => {
    vi.useFakeTimers();
    const { sent } = setup();
    fireEvent.touchStart(key("Down"));
    expect(sent).toHaveLength(1);
    vi.advanceTimersByTime(400);
    expect(sent).toHaveLength(2);
    vi.advanceTimersByTime(180);
    expect(sent).toHaveLength(5);
    fireEvent.touchEnd(key("Down"));
    vi.advanceTimersByTime(500);
    expect(sent).toHaveLength(5);
  });
});

describe("placement above the keyboard", () => {
  const OPEN = { keyboardOpen: true, top: 0, height: 450, bottomInset: 350 };
  const CLOSED = { keyboardOpen: false, top: 0, height: 768, bottomInset: 0 };
  const inset = () => document.documentElement.style.getPropertyValue("--gotty-bottom-inset");

  // jsdom does no layout, so give the strip the height a browser would.
  function setupPlaced() {
    vi.useFakeTimers();
    const s = setup();
    Object.defineProperty(s.keys.element, "offsetHeight", { value: 88, configurable: true });
    return s;
  }

  it("shows the strip right above the keyboard and shrinks the terminal", () => {
    const { host, keys } = setupPlaced();
    keys.applyArea(OPEN);
    expect(keys.element.hidden).toBe(false);
    expect(keys.element.style.top).toBe("362px");
    expect(host.elem.style.position).toBe("fixed");
    expect(host.elem.style.top).toBe("0px");
    expect(host.elem.style.height).toBe("362px");
    expect(inset()).toBe("438px");
    expect(host.fit).not.toHaveBeenCalled();
    vi.advanceTimersByTime(100);
    expect(host.fit).toHaveBeenCalledTimes(1);
  });

  it("follows a panned viewport", () => {
    const { host, keys } = setupPlaced();
    keys.applyArea({ keyboardOpen: true, top: 120, height: 450, bottomInset: 230 });
    expect(keys.element.style.top).toBe("482px");
    expect(host.elem.style.top).toBe("120px");
  });

  it("hides the strip and restores the terminal when the keyboard closes", () => {
    const { host, keys } = setupPlaced();
    keys.applyArea(OPEN);
    keys.applyArea(CLOSED);
    expect(keys.element.hidden).toBe(true);
    expect(host.elem.style.position).toBe("");
    expect(host.elem.style.height).toBe("");
    expect(inset()).toBe("0px");
  });

  it("re-places from the latest area and refits once after a burst, e.g. rotation", () => {
    const { host, keys } = setupPlaced();
    keys.applyArea(OPEN);
    vi.advanceTimersByTime(20);
    keys.applyArea({ keyboardOpen: true, top: 0, height: 300, bottomInset: 300 });
    vi.advanceTimersByTime(20);
    keys.applyArea({ keyboardOpen: true, top: 0, height: 200, bottomInset: 190 });
    expect(keys.element.style.top).toBe("112px");
    expect(host.elem.style.height).toBe("112px");
    expect(inset()).toBe("278px");
    vi.advanceTimersByTime(100);
    expect(host.fit).toHaveBeenCalledTimes(1);
  });

  it("does not refit again for a repeat report of the same area", () => {
    const { host, keys } = setupPlaced();
    keys.applyArea(OPEN);
    vi.advanceTimersByTime(100);
    keys.applyArea({ ...OPEN });
    vi.advanceTimersByTime(100);
    expect(host.fit).toHaveBeenCalledTimes(1);
  });

  it("re-places without a refit when only the position changes", () => {
    const { host, keys } = setupPlaced();
    keys.applyArea(OPEN);
    vi.advanceTimersByTime(100);
    keys.applyArea({ ...OPEN, top: 40, bottomInset: 310 });
    expect(keys.element.style.top).toBe("402px");
    expect(host.elem.style.top).toBe("40px");
    vi.advanceTimersByTime(100);
    expect(host.fit).toHaveBeenCalledTimes(1);
  });

  it("never gives the terminal a negative height", () => {
    const { host, keys } = setupPlaced();
    keys.applyArea({ keyboardOpen: true, top: 0, height: 60, bottomInset: 300 });
    expect(host.elem.style.height).toBe("0px");
  });

  it("keeps the scroll position when the keyboard opens and closes", () => {
    const { host, keys } = setupPlaced();
    keys.applyArea(OPEN);
    vi.advanceTimersByTime(100);
    keys.applyArea(CLOSED);
    vi.advanceTimersByTime(100);
    expect(host.fit).toHaveBeenCalledTimes(2);
    expect(host.refit).not.toHaveBeenCalled();
  });

  it("stays hidden for a hardware keyboard and leaves its keys alone", () => {
    const { host, keys } = setupPlaced();
    host.term.textarea.focus();
    keys.applyArea({ ...CLOSED });
    expect(keys.element.hidden).toBe(true);
    expect(keys.transformInput("\x1b[A")).toBe("\x1b[A");
  });

  it("tracks the visual viewport once initialised", () => {
    const { host, keys, vv } = setupPlaced();
    host.term.textarea.focus();
    expect(keys.element.hidden).toBe(true);
    vv.height = window.innerHeight - 300;
    vv.dispatchEvent(new Event("resize"));
    expect(keys.element.hidden).toBe(false);
    host.term.textarea.blur();
    expect(keys.element.hidden).toBe(true);
  });
});
