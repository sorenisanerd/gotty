// Mobile key strip — two rows of the keys phone keyboards lack (Esc, Tab,
// Ctrl, Alt, Shift, arrows, Home/End, PgUp/PgDn and a few buried symbols),
// shown on touch devices. Ctrl/Alt/Shift arm for the next key, typed on
// either the phone keyboard or the strip. Built like the theme picker: an
// injected <style> plus DOM appended to the body.

import { Terminal } from "@xterm/xterm";
import { encodeChar, encodeSpecial, Modifiers, SpecialKey } from "./key-encoder";
import { VisibleArea, watchVisibleArea } from "./keyboard-viewport";

export const REPEAT_DELAY_MS = 400;
export const REPEAT_INTERVAL_MS = 60;
// The keyboard animates in, reporting many sizes; fit once it settles.
export const REFIT_DEBOUNCE_MS = 100;

// Inline styles applyArea puts on the terminal container while the keyboard
// is open, cleared again when it closes.
const TERMINAL_PLACEMENT = ["position", "top", "left", "width", "height"];

type KeyDef =
    | { name: string; label: string; kind: "mod"; mod: keyof Modifiers }
    | { name: string; label: string; kind: "char" }
    | { name: SpecialKey; label: string; kind: "special"; repeat?: boolean };

const ROWS: KeyDef[][] = [
    [
        { name: "Esc", label: "Esc", kind: "special" },
        { name: "/", label: "/", kind: "char" },
        { name: "-", label: "-", kind: "char" },
        { name: "|", label: "|", kind: "char" },
        { name: "Home", label: "Home", kind: "special" },
        { name: "Up", label: "↑", kind: "special", repeat: true },
        { name: "End", label: "End", kind: "special" },
        { name: "PgUp", label: "PgUp", kind: "special", repeat: true },
    ],
    [
        { name: "Tab", label: "Tab", kind: "special" },
        { name: "Ctrl", label: "Ctrl", kind: "mod", mod: "ctrl" },
        { name: "Alt", label: "Alt", kind: "mod", mod: "alt" },
        { name: "Shift", label: "Shift", kind: "mod", mod: "shift" },
        { name: "Left", label: "←", kind: "special", repeat: true },
        { name: "Down", label: "↓", kind: "special", repeat: true },
        { name: "Right", label: "→", kind: "special", repeat: true },
        { name: "PgDn", label: "PgDn", kind: "special", repeat: true },
    ],
];

const STYLE = `
#gotty-mobile-keys {
    position: fixed;
    left: 0;
    right: 0;
    bottom: 0;
    z-index: 9998;
    display: flex;
    flex-direction: column;
    gap: 4px;
    padding: 4px;
    box-sizing: border-box;
    background: rgba(30,30,30,0.92);
    backdrop-filter: blur(8px);
    border-top: 1px solid rgba(255,255,255,0.12);
    user-select: none;
    -webkit-user-select: none;
    touch-action: none;
}
#gotty-mobile-keys[hidden] {
    display: none;
}
#gotty-mobile-keys .gotty-mk-row {
    display: flex;
    gap: 4px;
}
#gotty-mobile-keys .gotty-mk-key {
    flex: 1 1 0;
    min-width: 0;
    height: 40px;
    padding: 0;
    border: 1px solid rgba(255,255,255,0.1);
    border-radius: 6px;
    background: rgba(255,255,255,0.06);
    color: #ddd;
    font-size: 14px;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    -webkit-tap-highlight-color: transparent;
}
#gotty-mobile-keys .gotty-mk-key:active {
    background: rgba(255,255,255,0.18);
}
#gotty-mobile-keys .gotty-mk-key.armed {
    background: rgba(74,222,128,0.25);
    border-color: #4ade80;
    color: #fff;
}
@media (max-height: 500px) {
    #gotty-mobile-keys .gotty-mk-key {
        height: 32px;
    }
}
`;

export interface MobileKeysHost {
    // The #terminal container
    elem: HTMLElement;
    term: Pick<Terminal, "input" | "modes" | "textarea">;
    // Fit the grid to the container, keeping the scroll position.
    fit(): void;
    setInputTransformer(fn: ((data: string) => string) | null): void;
}

export class MobileKeys {
    readonly element: HTMLElement;
    private host: MobileKeysHost;
    private mods: Modifiers = { ctrl: false, alt: false, shift: false };
    private modButtons = new Map<keyof Modifiers, HTMLButtonElement>();
    private repeatDelay: ReturnType<typeof setTimeout> | undefined;
    private repeatInterval: ReturnType<typeof setInterval> | undefined;
    private refitTimer: ReturnType<typeof setTimeout> | undefined;
    private lastArea: VisibleArea | undefined;
    // The terminal's inline height when it was last fitted; "" while it
    // fills the page.
    private fittedHeight = "";

    constructor(host: MobileKeysHost) {
        this.host = host;
        this.element = this.build();
        this.element.hidden = true;
    }

    setVisible(visible: boolean): void {
        this.element.hidden = !visible;
        if (!visible) {
            this.stopRepeat();
            this.disarm();
        }
    }

    // Show the strip while the keyboard is open, directly above it, and fit
    // the terminal into the space left. The 🎨 picker lifts itself by
    // --gotty-bottom-inset.
    applyArea(area: VisibleArea): void {
        const last = this.lastArea;
        if (last && last.keyboardOpen === area.keyboardOpen && last.top === area.top &&
            last.height === area.height && last.bottomInset === area.bottomInset) {
            return;
        }
        this.lastArea = { ...area };

        this.setVisible(area.keyboardOpen);
        const termStyle = this.host.elem.style;
        const rootStyle = document.documentElement.style;
        if (area.keyboardOpen) {
            const h = this.element.offsetHeight;
            termStyle.position = "fixed";
            termStyle.top = `${area.top}px`;
            termStyle.left = "0px";
            termStyle.width = "100%";
            termStyle.height = `${Math.max(0, area.height - h)}px`;
            this.element.style.top = `${area.top + area.height - h}px`;
            this.element.style.bottom = "auto";
            rootStyle.setProperty("--gotty-bottom-inset", `${area.bottomInset + h}px`);
        } else {
            TERMINAL_PLACEMENT.forEach((prop) => termStyle.removeProperty(prop));
            this.element.style.top = "";
            this.element.style.bottom = "";
            rootStyle.setProperty("--gotty-bottom-inset", "0px");
        }

        // Only fit when the terminal's size changed, not when the viewport
        // merely moved: each fit can resize the pty.
        if (termStyle.height !== this.fittedHeight) {
            this.fittedHeight = termStyle.height;
            clearTimeout(this.refitTimer);
            this.refitTimer = setTimeout(() => this.host.fit(), REFIT_DEBOUNCE_MS);
        }
    }

    // Installed as the terminal's input transformer: armed modifiers apply
    // to the next single character. Anything longer (autocorrect, paste, an
    // IME commit) is not a keypress, so it passes through untouched.
    transformInput(data: string): string {
        if (!this.mods.ctrl && !this.mods.alt && !this.mods.shift) {
            return data;
        }
        const out = [...data].length === 1 ? encodeChar(data, this.mods) : data;
        this.disarm();
        return out;
    }

    private disarm(): void {
        this.mods = { ctrl: false, alt: false, shift: false };
        this.modButtons.forEach((btn) => this.showArmed(btn, false));
    }

    private showArmed(btn: HTMLButtonElement, armed: boolean): void {
        btn.classList.toggle("armed", armed);
        btn.setAttribute("aria-pressed", String(armed));
    }

    private press(key: KeyDef): void {
        switch (key.kind) {
            case "mod":
                this.mods[key.mod] = !this.mods[key.mod];
                this.showArmed(this.modButtons.get(key.mod)!, this.mods[key.mod]);
                break;
            case "char":
                // Same path as a phone-keyboard character, so the
                // transformer applies any armed modifiers.
                this.host.term.input(key.name, true);
                break;
            case "special": {
                const bytes = encodeSpecial(key.name, this.mods, this.host.term.modes.applicationCursorKeysMode);
                // Disarm first, or the transformer would see the modifiers
                // still armed when these bytes come back through onData.
                this.disarm();
                this.host.term.input(bytes, true);
                break;
            }
        }
    }

    private startRepeat(key: KeyDef): void {
        this.stopRepeat();
        this.press(key);
        this.repeatDelay = setTimeout(() => {
            this.press(key);
            this.repeatInterval = setInterval(() => this.press(key), REPEAT_INTERVAL_MS);
        }, REPEAT_DELAY_MS);
    }

    private stopRepeat(): void {
        clearTimeout(this.repeatDelay);
        clearInterval(this.repeatInterval);
        this.repeatDelay = undefined;
        this.repeatInterval = undefined;
    }

    private buildKey(key: KeyDef): HTMLButtonElement {
        const btn = document.createElement("button");
        btn.className = "gotty-mk-key";
        btn.type = "button";
        btn.dataset.key = key.name;
        btn.textContent = key.label;
        btn.setAttribute("aria-label", key.name);
        const repeat = key.kind === "special" && key.repeat === true;

        // Cancelling touchstart and mousedown keeps focus on xterm's
        // textarea, so the phone keyboard stays open. Cancelling touchstart
        // also suppresses the emulated click, so taps act on touchend
        // (which is also what iOS needs).
        btn.addEventListener("touchstart", (e) => {
            e.preventDefault();
            if (repeat) this.startRepeat(key);
        }, { passive: false });
        btn.addEventListener("touchend", (e) => {
            e.preventDefault();
            if (repeat) this.stopRepeat();
            else this.press(key);
        });
        btn.addEventListener("touchcancel", () => this.stopRepeat());
        btn.addEventListener("mousedown", (e) => {
            e.preventDefault();
            if (repeat) this.startRepeat(key);
        });
        btn.addEventListener("mouseup", () => this.stopRepeat());
        btn.addEventListener("mouseleave", () => this.stopRepeat());
        btn.addEventListener("click", () => {
            if (!repeat) this.press(key);
        });

        if (key.kind === "mod") {
            this.modButtons.set(key.mod, btn);
            this.showArmed(btn, false);
        }
        return btn;
    }

    private build(): HTMLElement {
        const root = document.createElement("div");
        root.id = "gotty-mobile-keys";
        for (const row of ROWS) {
            const rowElem = document.createElement("div");
            rowElem.className = "gotty-mk-row";
            for (const key of row) {
                rowElem.appendChild(this.buildKey(key));
            }
            root.appendChild(rowElem);
        }
        return root;
    }
}

// Set up the strip if the server enabled it and the browser can tell us
// where the on-screen keyboard is. On a touch device that happens right
// away. Elsewhere it waits for the first touch of the terminal, so a
// convertible used as a tablet still gets the strip, while a desktop without
// a touch screen is never touched at all. Returns null when not set up (yet).
export function initMobileKeys(host: MobileKeysHost, enabled: boolean): MobileKeys | null {
    const vv = window.visualViewport;
    if (!enabled || !vv) {
        return null;
    }
    if (!window.matchMedia || !window.matchMedia("(pointer: coarse)").matches) {
        host.elem.addEventListener("touchstart", () => { setUpMobileKeys(host, vv); }, { once: true, passive: true });
        return null;
    }
    return setUpMobileKeys(host, vv);
}

function setUpMobileKeys(host: MobileKeysHost, vv: VisualViewport): MobileKeys {
    const style = document.createElement("style");
    style.textContent = STYLE;
    document.head.appendChild(style);

    const keys = new MobileKeys(host);
    document.body.appendChild(keys.element);
    host.setInputTransformer((data) => keys.transformInput(data));
    if (host.term.textarea) {
        watchVisibleArea(host.term.textarea, vv, (area) => keys.applyArea(area));
    }
    return keys;
}
