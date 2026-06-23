# Mobile Virtual Keyboard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
> **Canonical save location** per writing-plans skill is `docs/superpowers/plans/2026-06-23-mobile-virtual-keyboard.md`; copy this file there at execution start (plan-mode restricts edits to this path only).

**Goal:** Add a toggleable, responsive on-screen virtual keyboard bar for mobile users that supplies special keys (Esc, Tab, `~`, arrows, etc.) and sticky modifiers (Ctrl/Alt/Shift) that combine with the device's native keyboard, plus Copy/Paste-to-clipboard.

**Architecture:** A self-contained `VirtualKeyboard` controller injects a fixed-bottom key bar + floating toggle button into `document.body` (mirroring the existing `theme-picker.ts` floating-UI pattern). Sticky modifiers are applied to the *next* typed character by intercepting xterm's `onData` stream via a new `inputTransformer` hook on `GoTTYXterm`; virtual special keys are sent directly through `term.sendString`. Pure key→byte-sequence logic lives in a DOM-free `key-encoder.ts` module that is unit-tested with vitest.

**Tech Stack:** TypeScript, xterm.js v6, webpack (ts-loader), vitest (new, for pure-logic tests). No new runtime dependencies.

## Global Constraints

- No new runtime npm dependencies (vitest is devDependency only).
- Follow existing floating-UI pattern from `js/src/theme-picker.ts` (injected `<style>` + DOM appended to `document.body`, `z-index: 9999`).
- Do **not** modify the existing `alt-is-meta` custom key handler in `xterm.tsx` (`setupAltIsMeta`); the virtual keyboard uses a separate `onData` interception path.
- Toggle button renders **only on touch devices** (`'ontouchstart' in window || navigator.maxTouchPoints > 0`); open/closed state persists in `localStorage` key `gotty-vkb-open`.
- Bar buttons must call `preventDefault()` on `mousedown` so tapping them never blurs xterm's hidden textarea (which would dismiss the device soft keyboard and break the "arm Ctrl → type c" flow).
- Webpack output is embedded into the Go binary via `make assets`; the build produces `bindata/static/js/gotty.js`. No HTML template change is required (DOM is injected at runtime, like the theme picker).

---

## Context

gotty currently has no mobile affordances beyond a viewport meta tag and xterm's FitAddon. On phones the device soft keyboard lacks Esc, Tab, Ctrl, arrows, `~`, `|`, etc., making terminal use impractical. This feature adds a togglable on-screen key bar so mobile users can send those keys and modifier combos (e.g. Ctrl+C), and copy/paste via the system clipboard. Design decisions confirmed with the user: (1) sticky modifiers arm and then transform the next character from the device's native keyboard (so "Ctrl + type c" → `\x03`); (2) the toggle appears only on touch devices and remembers its open/closed state.

## File Structure

- **Create** `js/src/key-encoder.ts` — pure, DOM-free functions mapping a base character or named special key + modifier state to the byte sequence to send. Single responsibility: encoding. Unit-tested.
- **Create** `js/src/key-encoder.test.ts` — vitest tests for the encoder.
- **Create** `js/src/virtual-keyboard.ts` — the `VirtualKeyboard` UI controller + `initVirtualKeyboard(term)` entry. Owns the bar DOM, modifier state, copy/paste, and injected CSS.
- **Modify** `js/src/xterm.tsx` — add `sendString`, `getSelection`, `fit`, and the `inputTransformer` hook on the existing `onData` handler.
- **Modify** `js/src/main.ts` — call `initVirtualKeyboard(term)` after `wt.open()`.
- **Modify** `js/package.json` — add `vitest` devDependency + `test` script.

---

## Task 1: Pure key-encoder module (TDD)

**Files:**
- Create: `js/src/key-encoder.ts`
- Create: `js/src/key-encoder.test.ts`
- Modify: `js/package.json` (add vitest + test script)

**Interfaces:**
- Produces:
  - `interface Modifiers { ctrl: boolean; alt: boolean; shift: boolean; }`
  - `function encodeChar(ch: string, mods: Modifiers): string`
  - `function encodeSpecial(name: string, mods: Modifiers): string`
  - `const SPECIAL_KEYS: Record<string, { seq: string; shiftSeq?: string }>`

- [ ] **Step 1: Add vitest devDependency and test script to `js/package.json`**

In the `devDependencies` object add the line (keep alphabetical-ish ordering near the bottom):

```json
        "vitest": "^3.0.0",
```

Add a top-level `"scripts"` block right after the `"private": true,` line:

```json
    "scripts": {
        "test": "vitest run"
    },
```

- [ ] **Step 2: Install vitest**

Run: `cd js && npm install`
Expected: `node_modules/.bin/vitest` exists, no peer-dependency errors that abort install.

- [ ] **Step 3: Write the failing test** — create `js/src/key-encoder.test.ts`

```typescript
import { describe, it, expect } from "vitest";
import { encodeChar, encodeSpecial } from "./key-encoder";

const none = { ctrl: false, alt: false, shift: false };

describe("encodeChar", () => {
    it("passes plain characters through unchanged", () => {
        expect(encodeChar("c", none)).toBe("c");
    });
    it("maps Ctrl+letter to its control code", () => {
        expect(encodeChar("c", { ...none, ctrl: true })).toBe("\x03");
        expect(encodeChar("a", { ...none, ctrl: true })).toBe("\x01");
        expect(encodeChar("C", { ...none, ctrl: true })).toBe("\x03");
    });
    it("maps Ctrl+space to NUL", () => {
        expect(encodeChar(" ", { ...none, ctrl: true })).toBe("\x00");
    });
    it("prefixes Alt with ESC", () => {
        expect(encodeChar("x", { ...none, alt: true })).toBe("\x1bx");
    });
    it("uppercases with Shift", () => {
        expect(encodeChar("a", { ...none, shift: true })).toBe("A");
    });
    it("combines Ctrl+Alt (ESC then control code)", () => {
        expect(encodeChar("a", { ...none, ctrl: true, alt: true })).toBe("\x1b\x01");
    });
});

describe("encodeSpecial", () => {
    it("returns the base sequence for a known key", () => {
        expect(encodeSpecial("Esc", none)).toBe("\x1b");
        expect(encodeSpecial("Tab", none)).toBe("\x09");
        expect(encodeSpecial("Up", none)).toBe("\x1b[A");
    });
    it("uses the shifted sequence when Shift is armed", () => {
        expect(encodeSpecial("Tab", { ...none, shift: true })).toBe("\x1b[Z");
        expect(encodeSpecial("Up", { ...none, shift: true })).toBe("\x1b[1;2A");
    });
    it("prefixes specials with ESC when Alt is armed", () => {
        expect(encodeSpecial("Left", { ...none, alt: true })).toBe("\x1b\x1b[D");
    });
    it("returns empty string for an unknown key", () => {
        expect(encodeSpecial("Nope", none)).toBe("");
    });
});
```

- [ ] **Step 4: Run the test to verify it fails**

Run: `cd js && npx vitest run src/key-encoder.test.ts`
Expected: FAIL — `Failed to resolve import "./key-encoder"` (module does not exist yet).

- [ ] **Step 5: Write the implementation** — create `js/src/key-encoder.ts`

```typescript
// Pure, DOM-free encoding of keys + modifier state into the byte string to
// send to the PTY. Kept free of any browser/xterm dependency so it can be
// unit-tested in isolation.

export interface Modifiers {
    ctrl: boolean;
    alt: boolean;
    shift: boolean;
}

// Named special keys -> their escape/control sequence. `shiftSeq` is the
// variant sent when Shift is armed (CSI modifier 2).
export const SPECIAL_KEYS: Record<string, { seq: string; shiftSeq?: string }> = {
    Esc: { seq: "\x1b" },
    Tab: { seq: "\x09", shiftSeq: "\x1b[Z" },
    Up: { seq: "\x1b[A", shiftSeq: "\x1b[1;2A" },
    Down: { seq: "\x1b[B", shiftSeq: "\x1b[1;2B" },
    Right: { seq: "\x1b[C", shiftSeq: "\x1b[1;2C" },
    Left: { seq: "\x1b[D", shiftSeq: "\x1b[1;2D" },
    Home: { seq: "\x1b[H" },
    End: { seq: "\x1b[F" },
    PgUp: { seq: "\x1b[5~" },
    PgDn: { seq: "\x1b[6~" },
};

// Encode a single printable character with the armed modifiers.
// Order: Shift (uppercase) -> Ctrl (control code) -> Alt (ESC prefix).
export function encodeChar(ch: string, mods: Modifiers): string {
    let s = ch;
    if (mods.shift && s.length === 1) {
        s = s.toUpperCase();
    }
    if (mods.ctrl && s.length === 1) {
        if (s === " ") {
            s = "\x00";
        } else {
            const code = s.toUpperCase().charCodeAt(0);
            if (code >= 0x40 && code <= 0x5f) {
                s = String.fromCharCode(code & 0x1f);
            }
        }
    }
    if (mods.alt) {
        s = "\x1b" + s;
    }
    return s;
}

// Encode a named special key with the armed modifiers. Unknown keys -> "".
export function encodeSpecial(name: string, mods: Modifiers): string {
    const def = SPECIAL_KEYS[name];
    if (!def) {
        return "";
    }
    let s = mods.shift && def.shiftSeq ? def.shiftSeq : def.seq;
    if (mods.alt) {
        s = "\x1b" + s;
    }
    return s;
}
```

- [ ] **Step 6: Run the test to verify it passes**

Run: `cd js && npx vitest run src/key-encoder.test.ts`
Expected: PASS — all assertions green.

- [ ] **Step 7: Commit**

```bash
git add js/src/key-encoder.ts js/src/key-encoder.test.ts js/package.json js/package-lock.json
git commit -m "feat(mobile-kbd): add pure key-encoder module with tests"
```

---

## Task 2: GoTTYXterm input/clipboard hooks

**Files:**
- Modify: `js/src/xterm.tsx`

**Interfaces:**
- Consumes: nothing from earlier tasks.
- Produces (new public members on `GoTTYXterm`):
  - `inputTransformer?: (input: string) => string`
  - `setInputTransformer(fn: (input: string) => string): void`
  - `sendString(data: string): void`
  - `getSelection(): string`
  - `fit(): void`
  - The `onData` handler now routes typed input through `inputTransformer` when set.

- [ ] **Step 1: Add the new fields and methods**

In `js/src/xterm.tsx`, add the field declaration next to the other `toServer` / `encoder` fields (after line 28 `encoder: TextEncoder;`):

```typescript
    inputTransformer?: (input: string) => string;
```

Add these methods inside the `GoTTYXterm` class, immediately after the existing `focus()` method (currently the last method, lines 267–269):

```typescript
    setInputTransformer(fn: (input: string) => string): void {
        this.inputTransformer = fn;
    }

    sendString(data: string): void {
        this.toServer(this.encoder.encode(data));
    }

    getSelection(): string {
        return this.term.getSelection();
    }

    fit(): void {
        this.fitAddOn.fit();
        this.term.scrollToBottom();
    }
```

- [ ] **Step 2: Route typed input through the transformer**

In `js/src/xterm.tsx`, the `onInput` method's `onData` handler (currently lines 232–234):

```typescript
        this.onDataHandler = this.term.onData((input) => {
            this.toServer(this.encoder.encode(input));
        });
```

Replace it with:

```typescript
        this.onDataHandler = this.term.onData((input) => {
            const data = this.inputTransformer ? this.inputTransformer(input) : input;
            this.toServer(this.encoder.encode(data));
        });
```

- [ ] **Step 3: Type-check the change compiles**

Run: `cd js && npx tsc --noEmit -p tsconfig.json`
Expected: No errors. (If `tsconfig.json` has no `noEmit`-friendly setup, instead run `npx webpack --mode=development` and confirm it builds without TS errors — see Task 5.)

- [ ] **Step 4: Commit**

```bash
git add js/src/xterm.tsx
git commit -m "feat(mobile-kbd): add inputTransformer, sendString, getSelection, fit to GoTTYXterm"
```

---

## Task 3: VirtualKeyboard UI controller

**Files:**
- Create: `js/src/virtual-keyboard.ts`

**Interfaces:**
- Consumes:
  - From Task 1: `encodeChar`, `encodeSpecial`, `Modifiers` from `./key-encoder`.
  - From Task 2: `GoTTYXterm` with `setInputTransformer`, `sendString`, `getSelection`, `fit`, `focus`, `showMessage`.
- Produces: `function initVirtualKeyboard(term: GoTTYXterm): void`

- [ ] **Step 1: Create `js/src/virtual-keyboard.ts` with the controller**

```typescript
// A toggleable on-screen key bar for mobile/touch use. Supplies special keys
// (Esc, Tab, arrows, ~, |, ...) and sticky Ctrl/Alt/Shift modifiers that
// transform the next character typed on the device's native keyboard. Mirrors
// the floating-UI pattern in theme-picker.ts (injected style + body-appended
// DOM). Renders only on touch devices; open/closed state persists.

import { GoTTYXterm } from "./xterm";
import { encodeChar, encodeSpecial, Modifiers } from "./key-encoder";

const STORAGE_OPEN = "gotty-vkb-open";

type KeyDef =
    | { label: string; type: "mod"; mod: keyof Modifiers }
    | { label: string; type: "special"; name: string }
    | { label: string; type: "char"; char: string }
    | { label: string; type: "action"; action: "copy" | "paste" };

const KEYS: KeyDef[] = [
    { label: "Ctrl", type: "mod", mod: "ctrl" },
    { label: "Alt", type: "mod", mod: "alt" },
    { label: "Shift", type: "mod", mod: "shift" },
    { label: "Esc", type: "special", name: "Esc" },
    { label: "Tab", type: "special", name: "Tab" },
    { label: "~", type: "char", char: "~" },
    { label: "/", type: "char", char: "/" },
    { label: "|", type: "char", char: "|" },
    { label: "-", type: "char", char: "-" },
    { label: "←", type: "special", name: "Left" },
    { label: "↑", type: "special", name: "Up" },
    { label: "↓", type: "special", name: "Down" },
    { label: "→", type: "special", name: "Right" },
    { label: "Home", type: "special", name: "Home" },
    { label: "End", type: "special", name: "End" },
    { label: "PgUp", type: "special", name: "PgUp" },
    { label: "PgDn", type: "special", name: "PgDn" },
    { label: "Copy", type: "action", action: "copy" },
    { label: "Paste", type: "action", action: "paste" },
];

class VirtualKeyboard {
    private term: GoTTYXterm;
    private mods: Modifiers = { ctrl: false, alt: false, shift: false };
    private modButtons = new Map<keyof Modifiers, HTMLButtonElement>();
    private bar: HTMLElement;
    private toggleBtn: HTMLButtonElement;

    constructor(term: GoTTYXterm) {
        this.term = term;
        this.injectStyles();
        this.bar = this.buildBar();
        this.toggleBtn = this.buildToggle();
        document.body.appendChild(this.bar);
        document.body.appendChild(this.toggleBtn);
        this.term.setInputTransformer((input) => this.transformInput(input));
        if (localStorage.getItem(STORAGE_OPEN) === "1") {
            this.open();
        }
    }

    // Called from GoTTYXterm.onData: if a modifier is armed, transform the
    // single next character and clear the armed state.
    private transformInput(input: string): string {
        if (!this.anyArmed()) {
            return input;
        }
        if (input.length !== 1) {
            this.clearMods();
            return input;
        }
        const out = encodeChar(input, this.mods);
        this.clearMods();
        return out;
    }

    private anyArmed(): boolean {
        return this.mods.ctrl || this.mods.alt || this.mods.shift;
    }

    private clearMods(): void {
        this.mods = { ctrl: false, alt: false, shift: false };
        this.modButtons.forEach((b) => b.classList.remove("armed"));
    }

    private toggleMod(mod: keyof Modifiers): void {
        this.mods[mod] = !this.mods[mod];
        this.modButtons.get(mod)!.classList.toggle("armed", this.mods[mod]);
        this.term.focus();
    }

    private sendSpecial(name: string): void {
        this.term.sendString(encodeSpecial(name, this.mods));
        this.clearMods();
        this.term.focus();
    }

    private sendChar(ch: string): void {
        this.term.sendString(encodeChar(ch, this.mods));
        this.clearMods();
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
        this.clearMods();
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
        this.clearMods();
        this.term.focus();
    }

    private open(): void {
        document.body.classList.add("gotty-vkb-open");
        localStorage.setItem(STORAGE_OPEN, "1");
        this.term.fit();
    }

    private close(): void {
        document.body.classList.remove("gotty-vkb-open");
        localStorage.setItem(STORAGE_OPEN, "0");
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
        for (const key of KEYS) {
            const btn = document.createElement("button");
            btn.className = "gotty-vkb-key";
            btn.textContent = key.label;
            // Keep xterm's textarea focused so the soft keyboard stays open
            // and armed modifiers can transform the next typed character.
            btn.addEventListener("mousedown", (e) => e.preventDefault());
            btn.addEventListener("touchstart", (e) => e.preventDefault(), { passive: false });
            btn.addEventListener("click", (e) => {
                e.preventDefault();
                switch (key.type) {
                    case "mod":
                        this.toggleMod(key.mod);
                        break;
                    case "special":
                        this.sendSpecial(key.name);
                        break;
                    case "char":
                        this.sendChar(key.char);
                        break;
                    case "action":
                        key.action === "copy" ? this.copy() : this.paste();
                        break;
                }
            });
            if (key.type === "mod") {
                this.modButtons.set(key.mod, btn);
            }
            bar.appendChild(btn);
        }
        return bar;
    }

    private injectStyles(): void {
        const style = document.createElement("style");
        style.textContent = `
:root { --gotty-vkb-h: 46px; }
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
    height: var(--gotty-vkb-h);
    z-index: 9998;
    display: none;
    align-items: center;
    gap: 4px;
    padding: 4px 6px;
    box-sizing: border-box;
    overflow-x: auto;
    overflow-y: hidden;
    -webkit-overflow-scrolling: touch;
    background: rgba(20,20,20,0.95);
    backdrop-filter: blur(8px);
    border-top: 1px solid rgba(255,255,255,0.12);
}
body.gotty-vkb-open #gotty-vkb-bar { display: flex; }
body.gotty-vkb-open #terminal { height: calc(100% - var(--gotty-vkb-h)); }
#gotty-vkb-bar::-webkit-scrollbar { height: 0; }
.gotty-vkb-key {
    flex: 0 0 auto;
    min-width: 38px;
    height: 36px;
    padding: 0 10px;
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
`;
        document.head.appendChild(style);
    }
}

function isTouchDevice(): boolean {
    return "ontouchstart" in window || navigator.maxTouchPoints > 0;
}

export function initVirtualKeyboard(term: GoTTYXterm): void {
    if (!isTouchDevice()) {
        return;
    }
    new VirtualKeyboard(term);
}
```

- [ ] **Step 2: Type-check compiles** (full build covered in Task 5)

Run: `cd js && npx tsc --noEmit -p tsconfig.json`
Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add js/src/virtual-keyboard.ts
git commit -m "feat(mobile-kbd): add VirtualKeyboard UI controller"
```

---

## Task 4: Wire into application entry

**Files:**
- Modify: `js/src/main.ts`

**Interfaces:**
- Consumes: `initVirtualKeyboard` from `./virtual-keyboard` (Task 3). Must run **after** `wt.open()` so `term.toServer` (set during `WebTTY.open()` → `term.onInput`) is wired before any virtual key can send.

- [ ] **Step 1: Import the initializer**

In `js/src/main.ts`, after line 4 (`import { initThemePicker } from "./theme-picker";`) add:

```typescript
import { initVirtualKeyboard } from "./virtual-keyboard";
```

- [ ] **Step 2: Call it after the connection opens**

In `js/src/main.ts`, the line `const closer = wt.open();` (currently line 25). Immediately after it, add:

```typescript
    initVirtualKeyboard(term);
```

(Placed after `wt.open()` so `term.sendString` reaches a live `toServer`.)

- [ ] **Step 3: Commit**

```bash
git add js/src/main.ts
git commit -m "feat(mobile-kbd): wire virtual keyboard into main entry"
```

---

## Task 5: Build, run, and verify end-to-end

**Files:** none (build + verification only)

- [ ] **Step 1: Run unit tests**

Run: `cd js && npm test`
Expected: PASS — key-encoder suite green.

- [ ] **Step 2: Build the webpack bundle (dev mode for readable output)**

Run: `cd js && npx webpack --mode=development`
Expected: Compiles with no TypeScript errors; writes `bindata/static/js/gotty.js`.

- [ ] **Step 3: Build the Go binary with embedded assets**

Run: `cd /home/ncd/workspace/gotty && make assets && make`
Expected: `make assets` copies resources + bundle into `bindata/static/`; `make` produces `./gotty`.

- [ ] **Step 4: Run gotty with write enabled**

Run: `cd /home/ncd/workspace/gotty && ./gotty -w bash`
Expected: Server listening on `http://0.0.0.0:8080/`. (`-w` / `--permit-write` is required for input to reach the PTY; without it Ctrl+C etc. are ignored.)

- [ ] **Step 5: Verify in a mobile-emulated browser (Playwright MCP)**

Using the Playwright MCP browser tools:
1. `browser_navigate` to `http://localhost:8080/`.
2. `browser_resize` to a phone size (e.g. 390×844) **and** confirm touch detection — note: `navigator.maxTouchPoints` may be 0 in headless Chromium, so if the `⌨` button does not appear, temporarily verify by evaluating `new (window).VirtualKeyboard` is not exposed; instead test the touch gate by running `browser_run_code_unsafe` to dispatch creation, OR temporarily flip `initVirtualKeyboard` to skip the `isTouchDevice()` guard for local verification and revert after.
3. Confirm the `⌨` toggle button is visible bottom-left; click it; confirm the key bar appears along the bottom and the terminal shrinks (re-fits) above it.
4. Click `Esc`, `Tab`, arrow keys — confirm corresponding behavior in `bash` (e.g. Tab triggers completion, arrows recall history).
5. Click `Ctrl` (button highlights blue/armed), then type `c` via `browser_type` into the terminal — confirm `^C` interrupts (new prompt line). Confirm the `Ctrl` button auto-clears its armed state.
6. Click `~` and `|` — confirm those literal characters appear at the prompt.
7. Select some terminal text (drag), click `Copy`, confirm the "Copied" overlay appears; click `Paste`, confirm clipboard text is sent. (Clipboard API needs a secure context — works on `localhost`; over plain HTTP on a remote host it will be blocked, which is expected.)
8. Reload the page — confirm the bar's open/closed state persists (localStorage `gotty-vkb-open`).

- [ ] **Step 6: Production build + final commit**

```bash
cd /home/ncd/workspace/gotty/js && npx webpack --mode=production
cd /home/ncd/workspace/gotty && make assets
git add bindata/static/js/gotty.js bindata/static/js/gotty.js.map
git commit -m "build(mobile-kbd): rebuild embedded assets with virtual keyboard"
```

---

## Verification Summary

- **Automated:** `cd js && npm test` exercises the pure encoder (Ctrl→control codes, Alt→ESC prefix, Shift→uppercase, special-key sequences, shifted variants).
- **Build:** webpack compiles all new TS; `make` embeds the bundle into the Go binary.
- **Manual/Playwright:** toggle visibility on touch, key bar layout + terminal re-fit, special keys, armed-modifier + native-key combo (Ctrl+C), literal symbols, Copy/Paste via clipboard, persistence across reload.

## Self-Review Notes

- **Spec coverage:** special keys (Task 3 KEYS table + Task 1 sequences) ✓; toggleable virtual keyboard (Task 3 toggle + Task 4 wiring) ✓; responsive mobile (touch-only gate, fixed bottom bar, terminal re-fit) ✓; copy `Ctrl+Shift+C` semantics (Copy button + `getSelection` + clipboard write; Shift uppercasing handled by encoder) ✓; paste `Ctrl+Shift+V` (Paste button + clipboard read + `sendString`) ✓; `~` and other symbols (char keys) ✓.
- **Type consistency:** `Modifiers`, `encodeChar`, `encodeSpecial` signatures identical across Tasks 1/3; `setInputTransformer`/`sendString`/`getSelection`/`fit`/`showMessage`/`focus` all defined on `GoTTYXterm` (Task 2 + existing `xterm.tsx`).
- **Known limitation (documented in steps):** the armed-modifier + soft-keyboard flow relies on xterm's `onData` firing for typed characters; some Android soft keyboards emit composition input that xterm normalizes into `onData`, which this design handles, but exotic IME paths may bypass it. Clipboard API requires a secure context (HTTPS or localhost).
