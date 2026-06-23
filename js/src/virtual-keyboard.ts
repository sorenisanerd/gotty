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

type CharKey = { type: "char"; lower: string; upper: string; flex?: number };
type KeyDef =
    | CharKey
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
        { type: "char", lower: " ", upper: " ", flex: 6 },
    ],
];

class VirtualKeyboard {
    private term: GoTTYXterm;
    private mods: Modifiers = { ctrl: false, alt: false, shift: false };
    private modButtons = new Map<keyof Modifiers, HTMLButtonElement>();
    // Char buttons paired with their KeyDef so labels can be re-rendered on Shift.
    private charButtons: Array<{ btn: HTMLButtonElement; def: CharKey }> = [];
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

    private sendChar(def: CharKey): void {
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
                    if (key.lower === " ") {
                        btn.classList.add("gotty-vkb-space");
                    }
                } else {
                    btn.textContent = key.label;
                }
                // Keep xterm's textarea focused (never blur) on tap.
                btn.addEventListener("mousedown", (e) => e.preventDefault());
                const dispatch = () => {
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
                };
                // iOS WebKit (Safari/Chrome) suppresses the synthesized `click`
                // when `touchstart` is preventDefaulted, so the old click handler
                // never fired on iPhone. Activate on `touchend` for touch, and keep
                // `click` for desktop mouse (deduped so a touch never double-fires).
                let fromTouch = false;
                btn.addEventListener("touchstart", (e) => e.preventDefault(), { passive: false });
                btn.addEventListener("touchend", (e) => {
                    e.preventDefault();
                    fromTouch = true;
                    dispatch();
                }, { passive: false });
                btn.addEventListener("click", () => {
                    if (fromTouch) {
                        fromTouch = false;
                        return;
                    }
                    dispatch();
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
