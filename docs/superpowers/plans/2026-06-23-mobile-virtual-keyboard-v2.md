# Mobile Virtual Keyboard v2 — Full US Keyboard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
> **Canonical save location** per writing-plans skill is `docs/superpowers/plans/2026-06-23-mobile-virtual-keyboard-v2.md`; copy this file there at execution start (plan-mode restricts edits to the plan-mode path only).

**Goal:** Replace the v1 single-row horizontal-scrolling special-key bar with a full on-screen US (ANSI) keyboard that needs no horizontal sliding, toggled by the existing `⌨` icon, and that suppresses the device's native soft keyboard while open.

**Architecture:** The existing `VirtualKeyboard` controller in `js/src/virtual-keyboard.ts` is rebuilt to render a multi-row US-ANSI key grid (function row + number row + QWERTY + bottom row) using rows of `flex: 1` keys so everything fits the viewport width with **no horizontal scroll**. `Shift` is a sticky layer toggle that re-labels every key to its shifted variant (`1`→`!`, `q`→`Q`, `[`→`{`, …). `Ctrl`/`Alt` are one-shot armed modifiers applied to the next key tap and then auto-cleared. Every key tap sends directly through `term.sendString(...)` using the pure `encodeChar`/`encodeSpecial` functions in `js/src/key-encoder.ts` (reused, lightly extended). While the keyboard is open the native OS keyboard is suppressed by setting `inputmode="none"` on xterm's helper textarea, so the on-screen keyboard is the sole input source. The `⌨` toggle button, touch-only gate, and `localStorage` persistence are kept unchanged from v1.

**Tech Stack:** TypeScript, xterm.js v6, webpack (ts-loader), vitest (existing). No new runtime dependencies.

## Global Constraints

- No new runtime npm dependencies (vitest stays a devDependency only).
- Follow the existing floating-UI pattern from `js/src/theme-picker.ts` (injected `<style>` + DOM appended to `document.body`).
- Do **not** modify the existing `alt-is-meta` custom key handler in `xterm.tsx` (`setupAltIsMeta`).
- Keep the existing `⌨` toggle button, the touch-only gate (`isTouchDevice()` with the `gotty-vkb-force` opt-in override), and `localStorage["gotty-vkb-open"]` persistence exactly as in v1.
- Key taps must never blur xterm's textarea: keep `preventDefault()` on `mousedown`/`touchstart` for every key.
- Layout must fit the viewport width with **no horizontal scrolling** (this is the core v1 complaint being fixed) — rows of `flex: 1` keys, not an `overflow-x: auto` strip.
- While the keyboard is open the native soft keyboard must be suppressed (`inputmode="none"` on xterm's textarea); restored on close.
- Webpack output is embedded into the Go binary via `make assets`; rebuild `bindata/static/js/gotty.js` + `make` at the end. No HTML template change (DOM injected at runtime).

---

## Context

v1 shipped a toggleable bottom bar of special keys (Esc/Tab/arrows/`~`/`|`/Copy/Paste) plus sticky Ctrl/Alt/Shift that armed and transformed the **next** character typed on the device's native soft keyboard. Two problems surfaced in use:

1. **Sliding the bar is difficult.** The single row used `overflow-x: auto`; reaching keys past the visible edge meant fiddly horizontal scrolling on a phone.
2. **It relied on the native soft keyboard** for letters/digits, so two keyboards competed for screen space and the "arm modifier then type" flow was awkward.

v2 fixes both by providing a complete on-screen US keyboard (every letter, digit, and ANSI symbol present at once, no scroll) and suppressing the native keyboard so the on-screen one is the only input. Confirmed design decisions: (a) **suppress the native keyboard** while the virtual one is open — on-screen taps are the sole input; (b) **`Shift` toggles a symbol layer** (re-labels keys to their shifted variants) rather than a separate `?123` page. The `⌨` toggle icon behavior is unchanged.

## File Structure

- **Modify** `js/src/key-encoder.ts` — add `Backspace` (`\x7f`) and `Enter` (`\r`) to `SPECIAL_KEYS`. `encodeChar`/`encodeSpecial` are otherwise reused as-is.
- **Modify** `js/src/key-encoder.test.ts` — add tests for the two new specials and for `Ctrl`+symbol control codes.
- **Rewrite** `js/src/virtual-keyboard.ts` — replace the single-bar UI with the full US-keyboard grid, the Shift layer toggle, one-shot Ctrl/Alt, native-keyboard suppression, and dynamic height measurement. Keep `initVirtualKeyboard(term)`, the `⌨` toggle, the touch gate, and persistence.
- **Modify** `js/src/xterm.tsx` — add one method `setSoftKeyboardSuppressed(on: boolean)`. Leave everything else (including the v1 `inputTransformer` hook) untouched.
- **`js/src/main.ts`** — no change (already calls `initVirtualKeyboard(term)` after `wt.open()`).
- **Rebuild** `bindata/static/js/gotty.js` + `.map` and the Go binary.

---

## Task 1: Extend key-encoder with Backspace/Enter (TDD)

**Files:**
- Modify: `js/src/key-encoder.ts`
- Modify: `js/src/key-encoder.test.ts`

**Interfaces:**
- Consumes: nothing new.
- Produces: `SPECIAL_KEYS` gains `Backspace: { seq: "\x7f" }` and `Enter: { seq: "\r" }`. `encodeChar`/`encodeSpecial` signatures unchanged.

- [ ] **Step 1: Add the failing tests** — append to `js/src/key-encoder.test.ts` inside the existing `describe("encodeSpecial", ...)` block (and a new `encodeChar` case):

```typescript
    it("encodes Backspace as DEL and Enter as CR", () => {
        expect(encodeSpecial("Backspace", none)).toBe("\x7f");
        expect(encodeSpecial("Enter", none)).toBe("\r");
    });
```

And inside `describe("encodeChar", ...)`:

```typescript
    it("maps Ctrl+symbol into the C0 control range", () => {
        expect(encodeChar("[", { ...none, ctrl: true })).toBe("\x1b");
        expect(encodeChar("]", { ...none, ctrl: true })).toBe("\x1d");
    });
```

- [ ] **Step 2: Run to verify the new tests fail**

Run: `cd js && npx vitest run src/key-encoder.test.ts`
Expected: FAIL — `Backspace`/`Enter` return `""` (unknown key) so the new assertion fails. (The `Ctrl+[` test should already pass given the existing `0x40–0x5f` mask, but is added for regression safety.)

- [ ] **Step 3: Add the two specials** — in `js/src/key-encoder.ts`, add to the `SPECIAL_KEYS` object (after `PgDn`):

```typescript
    Backspace: { seq: "\x7f" },
    Enter: { seq: "\r" },
```

- [ ] **Step 4: Run to verify all tests pass**

Run: `cd js && npx vitest run src/key-encoder.test.ts`
Expected: PASS — all assertions green.

- [ ] **Step 5: Commit**

```bash
git add js/src/key-encoder.ts js/src/key-encoder.test.ts
git commit -m "feat(mobile-kbd): add Backspace/Enter specials to key-encoder"
```

---

## Task 2: Suppress the native soft keyboard from GoTTYXterm

**Files:**
- Modify: `js/src/xterm.tsx`

**Interfaces:**
- Consumes: nothing new.
- Produces (new public method on `GoTTYXterm`):
  - `setSoftKeyboardSuppressed(on: boolean): void` — when `on`, sets `inputmode="none"` on xterm's helper textarea so focusing it does not raise the OS keyboard; when off, removes the attribute. Re-focuses the terminal so the change takes effect.

- [ ] **Step 1: Add the method** — in `js/src/xterm.tsx`, immediately after the existing `fit()` method (currently the last method in the class), add:

```typescript
    // When suppressed, focusing xterm's hidden textarea will not raise the
    // device's native soft keyboard (used while the on-screen keyboard is open
    // so it is the sole input source). xterm exposes `term.textarea`.
    setSoftKeyboardSuppressed(on: boolean): void {
        const ta = this.term.textarea;
        if (!ta) {
            return;
        }
        if (on) {
            ta.setAttribute("inputmode", "none");
        } else {
            ta.removeAttribute("inputmode");
        }
        // Re-focus so the browser re-evaluates whether to show the OS keyboard.
        this.term.blur();
        this.term.focus();
    }
```

- [ ] **Step 2: Type-check the change compiles**

Run: `cd js && npx webpack --mode=development`
Expected: Compiles with no TypeScript errors; writes `bindata/static/js/gotty.js`. (`term.textarea` is a public `HTMLTextAreaElement | undefined` in xterm v6.)

- [ ] **Step 3: Commit**

```bash
git add js/src/xterm.tsx
git commit -m "feat(mobile-kbd): add setSoftKeyboardSuppressed to GoTTYXterm"
```

---

## Task 3: Rebuild VirtualKeyboard as a full US keyboard

**Files:**
- Rewrite: `js/src/virtual-keyboard.ts`

**Interfaces:**
- Consumes:
  - From Task 1: `encodeChar`, `encodeSpecial`, `Modifiers` from `./key-encoder` (with new `Backspace`/`Enter`).
  - From Task 2: `GoTTYXterm` with `sendString`, `getSelection`, `fit`, `focus`, `showMessage`, `setSoftKeyboardSuppressed`.
- Produces: `function initVirtualKeyboard(term: GoTTYXterm): void` (unchanged signature, so `main.ts` needs no edit).

**Behavior contract:**
- **Layout** (rows of `flex: 1` keys, no horizontal scroll), full US ANSI:
  - **Function row:** `Esc` `←` `↑` `↓` `→` `Home` `End` `PgUp` `PgDn` `Copy` `Paste`
  - **Number row:** `` ` `` `1` `2` `3` `4` `5` `6` `7` `8` `9` `0` `-` `=` `⌫`(Backspace, wide)
  - **Top row:** `Tab`(wide) `q` `w` `e` `r` `t` `y` `u` `i` `o` `p` `[` `]` `\`
  - **Home row:** `a` `s` `d` `f` `g` `h` `j` `k` `l` `;` `'` `↵`(Enter, wide)
  - **Bottom row:** `⇧`(Shift, wide) `z` `x` `c` `v` `b` `n` `m` `,` `.` `/`
  - **Space row:** `Ctrl` `Alt` `␣`(Space, very wide)
- **Shifted layer** (when Shift armed): letters → uppercase; `` ` 1 2 3 4 5 6 7 8 9 0 - = `` → `~ ! @ # $ % ^ & * ( ) _ +`; `[ ] \` → `{ } |`; `; '` → `: "`; `, . /` → `< > ?`. Re-render all key labels on Shift toggle.
- **Modifiers:**
  - `Shift` = sticky layer toggle (caps-lock style): stays on until tapped again; flips labels; highlighted while on.
  - `Ctrl`, `Alt` = one-shot armed: highlight when armed, apply to the next key tap via the encoder, then auto-clear (so `Ctrl` then `c` → `\x03`). Shift is **not** cleared by a key tap (only Ctrl/Alt are).
- **Sending:** char key → resolved char = `shift ? upper : lower`; `term.sendString(encodeChar(char, { ctrl, alt, shift: false }))` (shift already baked into the resolved char). Special key → `term.sendString(encodeSpecial(name, { ctrl, alt, shift }))` (passes shift so shifted arrows/Tab use their `shiftSeq`). Copy/Paste unchanged from v1. After any non-mod key, clear Ctrl/Alt only.
- **Open/close:** `open()` adds `body.gotty-vkb-open`, persists `"1"`, calls `term.setSoftKeyboardSuppressed(true)`, measures the rendered keyboard height into CSS var `--gotty-vkb-h`, then `term.fit()`. `close()` removes the class, persists `"0"`, calls `term.setSoftKeyboardSuppressed(false)`, then `term.fit()`. On `window.resize` while open, re-measure height + `fit()`.
- The v1 `setInputTransformer` arm-and-transform-native path is **not** used in v2 (native input is suppressed); do not call `term.setInputTransformer`.

- [ ] **Step 1: Replace `js/src/virtual-keyboard.ts` with the full-keyboard implementation**

```typescript
// A toggleable full on-screen US (ANSI) keyboard for mobile/touch use. Renders
// every letter, digit, and ANSI symbol at once (no horizontal scrolling) plus a
// function row (Esc, arrows, Home/End, PgUp/PgDn, Copy, Paste) and Ctrl/Alt/Shift
// modifiers. Shift is a sticky layer toggle that re-labels keys to their shifted
// variant; Ctrl/Alt are one-shot modifiers applied to the next key tap. While the
// keyboard is open the native soft keyboard is suppressed so on-screen taps are
// the sole input. Mirrors the floating-UI pattern in theme-picker.ts. Touch-only;
// open/closed state persists in localStorage.

import { GoTTYXterm } from "./xterm";
import { encodeChar, encodeSpecial, Modifiers } from "./key-encoder";

const STORAGE_OPEN = "gotty-vkb-open";
const STORAGE_FORCE = "gotty-vkb-force";

type KeyDef =
    | { type: "char"; lower: string; upper: string; flex?: number }
    | { type: "special"; name: string; label: string; flex?: number }
    | { type: "mod"; mod: keyof Modifiers; label: string; flex?: number }
    | { type: "action"; action: "copy" | "paste"; label: string; flex?: number };

function c(lower: string, upper: string): KeyDef {
    return { type: "char", lower, upper };
}

// Full US-ANSI layout, one inner array per visual row.
const ROWS: KeyDef[][] = [
    [
        { type: "special", name: "Esc", label: "Esc" },
        { type: "special", name: "Left", label: "←" },
        { type: "special", name: "Up", label: "↑" },
        { type: "special", name: "Down", label: "↓" },
        { type: "special", name: "Right", label: "→" },
        { type: "special", name: "Home", label: "Home" },
        { type: "special", name: "End", label: "End" },
        { type: "special", name: "PgUp", label: "PgUp" },
        { type: "special", name: "PgDn", label: "PgDn" },
        { type: "action", action: "copy", label: "Copy" },
        { type: "action", action: "paste", label: "Paste" },
    ],
    [
        c("`", "~"), c("1", "!"), c("2", "@"), c("3", "#"), c("4", "$"),
        c("5", "%"), c("6", "^"), c("7", "&"), c("8", "*"), c("9", "("),
        c("0", ")"), c("-", "_"), c("=", "+"),
        { type: "special", name: "Backspace", label: "⌫", flex: 1.6 },
    ],
    [
        { type: "special", name: "Tab", label: "Tab", flex: 1.6 },
        c("q", "Q"), c("w", "W"), c("e", "E"), c("r", "R"), c("t", "T"),
        c("y", "Y"), c("u", "U"), c("i", "I"), c("o", "O"), c("p", "P"),
        c("[", "{"), c("]", "}"), c("\\", "|"),
    ],
    [
        c("a", "A"), c("s", "S"), c("d", "D"), c("f", "F"), c("g", "G"),
        c("h", "H"), c("j", "J"), c("k", "K"), c("l", "L"), c(";", ":"),
        c("'", "\""),
        { type: "special", name: "Enter", label: "↵", flex: 1.8 },
    ],
    [
        { type: "mod", mod: "shift", label: "⇧", flex: 1.8 },
        c("z", "Z"), c("x", "X"), c("c", "C"), c("v", "V"), c("b", "B"),
        c("n", "N"), c("m", "M"), c(",", "<"), c(".", ">"), c("/", "?"),
    ],
    [
        { type: "mod", mod: "ctrl", label: "Ctrl", flex: 1.4 },
        { type: "mod", mod: "alt", label: "Alt", flex: 1.4 },
        { type: "char", lower: " ", upper: " ", label: undefined as never, flex: 6 } as KeyDef,
    ],
];

class VirtualKeyboard {
    private term: GoTTYXterm;
    private mods: Modifiers = { ctrl: false, alt: false, shift: false };
    private modButtons = new Map<keyof Modifiers, HTMLButtonElement>();
    // Char buttons paired with their KeyDef so labels can be re-rendered on Shift.
    private charButtons: Array<{ btn: HTMLButtonElement; def: KeyDef & { type: "char" } }> = [];
    private bar: HTMLElement;
    private toggleBtn: HTMLButtonElement;
    private resizeListener: () => void;

    constructor(term: GoTTYXterm) {
        this.term = term;
        this.injectStyles();
        this.bar = this.buildBar();
        this.toggleBtn = this.buildToggle();
        document.body.appendChild(this.bar);
        document.body.appendChild(this.toggleBtn);
        this.resizeListener = () => {
            if (document.body.classList.contains("gotty-vkb-open")) {
                this.measureHeight();
                this.term.fit();
            }
        };
        window.addEventListener("resize", this.resizeListener);
        if (localStorage.getItem(STORAGE_OPEN) === "1") {
            this.open();
        }
    }

    private clearOneShot(): void {
        // Ctrl/Alt are one-shot; Shift is a sticky layer and is left intact.
        this.mods.ctrl = false;
        this.mods.alt = false;
        this.modButtons.get("ctrl")!.classList.remove("armed");
        this.modButtons.get("alt")!.classList.remove("armed");
    }

    private toggleMod(mod: keyof Modifiers): void {
        this.mods[mod] = !this.mods[mod];
        this.modButtons.get(mod)!.classList.toggle("armed", this.mods[mod]);
        if (mod === "shift") {
            this.renderLabels();
        }
        this.term.focus();
    }

    private renderLabels(): void {
        for (const { btn, def } of this.charButtons) {
            btn.textContent = this.mods.shift ? def.upper : def.lower;
        }
    }

    private sendChar(def: KeyDef & { type: "char" }): void {
        const ch = this.mods.shift ? def.upper : def.lower;
        this.term.sendString(encodeChar(ch, { ctrl: this.mods.ctrl, alt: this.mods.alt, shift: false }));
        this.clearOneShot();
        this.term.focus();
    }

    private sendSpecial(name: string): void {
        this.term.sendString(encodeSpecial(name, this.mods));
        this.clearOneShot();
        this.term.focus();
    }

    private async copy(): Promise<void> {
        const sel = this.term.getSelection();
        if (sel && navigator.clipboard) {
            try {
                await navigator.clipboard.writeText(sel);
                this.term.showMessage("Copied", 1000);
            } catch (e) {
                console.warn("clipboard write failed", e);
            }
        }
        this.clearOneShot();
        this.term.focus();
    }

    private async paste(): Promise<void> {
        if (navigator.clipboard) {
            try {
                const t = await navigator.clipboard.readText();
                if (t) {
                    this.term.sendString(t);
                }
            } catch (e) {
                console.warn("clipboard read failed", e);
            }
        }
        this.clearOneShot();
        this.term.focus();
    }

    private measureHeight(): void {
        const h = this.bar.offsetHeight;
        if (h > 0) {
            document.documentElement.style.setProperty("--gotty-vkb-h", h + "px");
        }
    }

    private open(): void {
        document.body.classList.add("gotty-vkb-open");
        localStorage.setItem(STORAGE_OPEN, "1");
        this.term.setSoftKeyboardSuppressed(true);
        this.measureHeight();
        this.term.fit();
    }

    private close(): void {
        document.body.classList.remove("gotty-vkb-open");
        localStorage.setItem(STORAGE_OPEN, "0");
        this.term.setSoftKeyboardSuppressed(false);
        this.term.fit();
    }

    private toggle(): void {
        document.body.classList.contains("gotty-vkb-open") ? this.close() : this.open();
    }

    private buildToggle(): HTMLButtonElement {
        const b = document.createElement("button");
        b.id = "gotty-vkb-btn";
        b.textContent = "⌨";
        b.setAttribute("aria-label", "Toggle virtual keyboard");
        b.addEventListener("click", (e) => {
            e.stopPropagation();
            this.toggle();
        });
        return b;
    }

    private buildBar(): HTMLElement {
        const bar = document.createElement("div");
        bar.id = "gotty-vkb-bar";
        for (const row of ROWS) {
            const rowEl = document.createElement("div");
            rowEl.className = "gotty-vkb-row";
            for (const key of row) {
                const btn = document.createElement("button");
                btn.className = "gotty-vkb-key";
                if (key.flex) {
                    btn.style.flex = String(key.flex);
                }
                if (key.type === "char") {
                    btn.textContent = key.lower;
                    this.charButtons.push({ btn, def: key });
                } else {
                    btn.textContent = key.label;
                }
                if (key.type === "char" && key.lower === " ") {
                    btn.classList.add("gotty-vkb-space");
                }
                // Keep xterm's textarea focused (never blur) on tap.
                btn.addEventListener("mousedown", (e) => e.preventDefault());
                btn.addEventListener("touchstart", (e) => e.preventDefault(), { passive: false });
                btn.addEventListener("click", (e) => {
                    e.preventDefault();
                    switch (key.type) {
                        case "char":
                            this.sendChar(key);
                            break;
                        case "special":
                            this.sendSpecial(key.name);
                            break;
                        case "mod":
                            this.toggleMod(key.mod);
                            break;
                        case "action":
                            key.action === "copy" ? this.copy() : this.paste();
                            break;
                    }
                });
                if (key.type === "mod") {
                    this.modButtons.set(key.mod, btn);
                }
                rowEl.appendChild(btn);
            }
            bar.appendChild(rowEl);
        }
        return bar;
    }

    private injectStyles(): void {
        const style = document.createElement("style");
        style.textContent = `
:root { --gotty-vkb-h: 230px; }
#gotty-vkb-btn {
    position: fixed;
    bottom: 12px;
    left: 12px;
    width: 36px;
    height: 36px;
    border-radius: 50%;
    border: none;
    background: rgba(0,0,0,0.55);
    color: #fff;
    font-size: 18px;
    cursor: pointer;
    z-index: 9999;
    display: flex;
    align-items: center;
    justify-content: center;
    backdrop-filter: blur(4px);
    line-height: 1;
    transition: background 0.2s, bottom 0.2s;
}
#gotty-vkb-btn:hover { background: rgba(0,0,0,0.75); }
body.gotty-vkb-open #gotty-vkb-btn { bottom: calc(var(--gotty-vkb-h) + 14px); }
#gotty-vkb-bar {
    position: fixed;
    left: 0;
    right: 0;
    bottom: 0;
    z-index: 9998;
    display: none;
    flex-direction: column;
    gap: 4px;
    padding: 4px;
    box-sizing: border-box;
    background: rgba(20,20,20,0.96);
    backdrop-filter: blur(8px);
    border-top: 1px solid rgba(255,255,255,0.12);
}
body.gotty-vkb-open #gotty-vkb-bar { display: flex; }
body.gotty-vkb-open #terminal { height: calc(100% - var(--gotty-vkb-h)); }
.gotty-vkb-row {
    display: flex;
    gap: 4px;
    width: 100%;
}
.gotty-vkb-key {
    flex: 1;
    min-width: 0;
    height: 34px;
    padding: 0;
    border: 1px solid rgba(255,255,255,0.18);
    border-radius: 6px;
    background: rgba(255,255,255,0.08);
    color: #fff;
    font-size: 14px;
    font-family: monospace;
    cursor: pointer;
    user-select: none;
    -webkit-user-select: none;
    touch-action: manipulation;
}
.gotty-vkb-key:active { background: rgba(255,255,255,0.22); }
.gotty-vkb-key.armed {
    background: #2563eb;
    border-color: #2563eb;
}
@media (max-width: 480px) {
    .gotty-vkb-key { height: 30px; font-size: 12px; }
}
`;
        document.head.appendChild(style);
    }
}

function isTouchDevice(): boolean {
    // Opt-in override for non-touch devices (and for testing): set
    // localStorage["gotty-vkb-force"] = "1".
    if (localStorage.getItem(STORAGE_FORCE) === "1") {
        return true;
    }
    return "ontouchstart" in window || navigator.maxTouchPoints > 0;
}

export function initVirtualKeyboard(term: GoTTYXterm): void {
    if (!isTouchDevice()) {
        return;
    }
    new VirtualKeyboard(term);
}
```

> **Note on the Space `KeyDef`:** the space entry is a `char` key with `lower`/`upper` both `" "`. It carries a `flex` of 6 and gets the `gotty-vkb-space` class. Its blank label is intentional (the wide bar reads as a spacebar); `renderLabels()` will set its text to `" "` which is also blank — acceptable. If the `as KeyDef` cast on the space entry trips strict TS, replace that entry with `{ type: "char", lower: " ", upper: " ", flex: 6 }` (drop the `label` field entirely — `char` keys have no `label`).

- [ ] **Step 2: Type-check / build compiles**

Run: `cd js && npx webpack --mode=development`
Expected: Compiles with no TypeScript errors; writes `bindata/static/js/gotty.js`.
(If the space-entry `as KeyDef` cast errors, apply the fix in the note above and rebuild.)

- [ ] **Step 3: Run unit tests (regression — encoder still green)**

Run: `cd js && npm test`
Expected: PASS — key-encoder suite green.

- [ ] **Step 4: Commit**

```bash
git add js/src/virtual-keyboard.ts
git commit -m "feat(mobile-kbd): replace special-key bar with full US keyboard"
```

---

## Task 4: Build, run, and verify end-to-end

**Files:** none (build + verification only)

- [ ] **Step 1: Production webpack build**

Run: `cd /home/ncd/workspace/gotty/js && npx webpack --mode=production`
Expected: Compiles; updates `bindata/static/js/gotty.js` + `.map`.

- [ ] **Step 2: Build the Go binary with embedded assets**

Run: `cd /home/ncd/workspace/gotty && make assets && make`
Expected: `make assets` copies the bundle into `bindata/static/`; `make` produces `./gotty`.

- [ ] **Step 3: Run gotty with write enabled on a free port**

Run: `cd /home/ncd/workspace/gotty && ./gotty --config /dev/null -w -a 127.0.0.1 -p 8765 bash`
Expected: Server listening on `http://127.0.0.1:8765/`. (`--config /dev/null` avoids the user's `~/.gotty` which forces a busy address; `-w` is required for input to reach the PTY.)

- [ ] **Step 4: Verify in a mobile-emulated browser (Playwright MCP)**

Force the touch gate for headless Chromium (where `maxTouchPoints` is 0): before navigating, after the page first loads, set `localStorage["gotty-vkb-force"] = "1"` and reload.
1. `browser_navigate` to `http://127.0.0.1:8765/`; `browser_resize` to 390×844; run `localStorage.setItem("gotty-vkb-force","1")` via `browser_evaluate`; reload.
2. Confirm the `⌨` toggle is visible bottom-left. Click it; confirm the **full keyboard** appears (function row + number row + QWERTY + bottom row) with **no horizontal scrollbar**, and the terminal shrinks above it.
3. Tap letters `l` `s` then `Enter` (`↵`) — confirm `ls` runs in bash.
4. Tap `Ctrl` (highlights blue), then tap `c` — confirm `^C` interrupts (fresh prompt) and `Ctrl` auto-clears.
5. Tap `Shift` (highlights, labels flip to uppercase/symbols), tap `4` — confirm `$` is sent; confirm `Shift` stays armed (sticky); tap `Shift` again to release.
6. Tap `~` `|` `/` `[` `]` — confirm those literal characters appear.
7. Tap arrows (`↑` recalls history; `←`/`→` move the cursor); tap `Tab` (completion); tap `⌫` (deletes a char).
8. Confirm the native OS keyboard does not appear while open (check `document.querySelector('.xterm-helper-textarea')?.getAttribute('inputmode')` === `"none"` via `browser_evaluate`).
9. Select terminal text (drag), tap `Copy` → "Copied" overlay; tap `Paste` → clipboard text is sent. (Clipboard needs a secure context; `localhost`/`127.0.0.1` qualifies.)
10. Reload — confirm open/closed state persists; close via `⌨` and confirm `inputmode` attribute is removed and the terminal re-fills the height.

- [ ] **Step 5: Final assets commit**

```bash
cd /home/ncd/workspace/gotty
git add bindata/static/js/gotty.js bindata/static/js/gotty.js.map
git commit -m "build(mobile-kbd): rebuild embedded assets with full US keyboard"
```

---

## Task 5: Update the plan doc in the repo

**Files:**
- Create: `docs/superpowers/plans/2026-06-23-mobile-virtual-keyboard-v2.md` (copy of this plan)

- [ ] **Step 1: Copy this plan into the repo and commit**

```bash
cp <this-plan-file> docs/superpowers/plans/2026-06-23-mobile-virtual-keyboard-v2.md
git add docs/superpowers/plans/2026-06-23-mobile-virtual-keyboard-v2.md
git commit -m "docs(mobile-kbd): add full US keyboard (v2) implementation plan"
```

---

## Verification Summary

- **Automated:** `cd js && npm test` — encoder unit tests, including new `Backspace`→`\x7f`, `Enter`→`\r`, and `Ctrl`+symbol control codes.
- **Build:** webpack compiles all changed TS; `make` embeds the bundle into the Go binary.
- **Manual/Playwright:** full keyboard renders with no horizontal scroll; letters/digits/symbols send; Shift layer toggle flips labels and shifted chars; one-shot Ctrl (Ctrl+C) and Alt; arrows/Tab/Backspace/Enter; native keyboard suppressed (`inputmode="none"`) while open and restored on close; Copy/Paste via clipboard; open/closed persistence; terminal re-fit on toggle and resize.

## Self-Review Notes

- **Spec coverage:** (1) "sliding the bar is difficult" → fixed by rows of `flex: 1` keys, `flex-direction: column`, no `overflow-x` (Task 3 layout + CSS) ✓; (2) "implement full US keyboard" → complete US-ANSI grid with Shift symbol layer covering every letter/digit/ANSI symbol (Task 3 `ROWS` + shifted variants) ✓; (3) "toggle by clicking the icon as current" → `⌨` toggle button kept unchanged (Task 3 `buildToggle`) ✓.
- **Reused:** `encodeChar`/`encodeSpecial`/`Modifiers` (`key-encoder.ts`), `sendString`/`getSelection`/`fit`/`showMessage`/`focus` (`xterm.tsx`), the touch gate + persistence + floating-UI pattern from v1.
- **Type consistency:** `setSoftKeyboardSuppressed` defined in Task 2 and called in Task 3; `encodeChar(ch, {ctrl, alt, shift:false})` and `encodeSpecial(name, mods)` match the Task 1 signatures; `SPECIAL_KEYS` keys used in `ROWS` (`Esc`, `Tab`, `Left/Up/Down/Right`, `Home`, `End`, `PgUp`, `PgDn`, `Backspace`, `Enter`) all exist after Task 1.
- **Known limitations:** `inputmode="none"` is the standard trick to suppress the OS keyboard but a few mobile browsers may still flash it briefly on focus; native input is otherwise unused while open. Clipboard API requires a secure context (HTTPS or localhost/127.0.0.1). The decorative space key sends a literal space (Ctrl+Space → NUL still works via `encodeChar(" ", {ctrl})`).
