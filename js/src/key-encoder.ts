// Turns a key plus the modifiers armed on the mobile key strip into the bytes
// a real keyboard would make xterm send. Kept free of the DOM so it can be
// tested on its own.

export interface Modifiers {
    ctrl: boolean;
    alt: boolean;
    shift: boolean;
}

export const NO_MODS: Readonly<Modifiers> = { ctrl: false, alt: false, shift: false };

export type SpecialKey = "Esc" | "Tab" | "Up" | "Down" | "Left" | "Right" | "Home" | "End" | "PgUp" | "PgDn";

// Ctrl+symbol control codes, as xterm sends them. Letters are handled
// separately by masking.
const CTRL_SYMBOLS: { [ch: string]: string } = {
    " ": "\x00",
    "@": "\x00",
    "[": "\x1b",
    "\\": "\x1c",
    "]": "\x1d",
    "^": "\x1e",
    "_": "\x1f",
    "/": "\x1f",
    "?": "\x7f",
};

// Final bytes of the cursor-style keys: CSI <final>, SS3 <final> in
// application cursor mode, CSI 1;<m> <final> when modified.
const CURSOR_FINALS: { [key: string]: string } = {
    Up: "A",
    Down: "B",
    Right: "C",
    Left: "D",
    Home: "H",
    End: "F",
};

// Parameters of the tilde-style keys: CSI <n> ~, CSI <n>;<m> ~ when modified.
const TILDE_PARAMS: { [key: string]: string } = {
    PgUp: "5",
    PgDn: "6",
};

// Encode one character (a single code point) typed on the phone keyboard or
// the strip.
export function encodeChar(ch: string, mods: Modifiers): string {
    let out = ch;
    if (mods.shift && /^[a-z]$/.test(out)) {
        out = out.toUpperCase();
    }
    if (mods.ctrl) {
        if (/^[a-z]$/i.test(out)) {
            out = String.fromCharCode(out.charCodeAt(0) & 0x1f);
        } else if (out in CTRL_SYMBOLS) {
            out = CTRL_SYMBOLS[out];
        }
    }
    return mods.alt ? "\x1b" + out : out;
}

// xterm's modifier parameter: 1 + Shift(1) + Alt(2) + Ctrl(4).
function modifierParam(mods: Modifiers): number {
    return 1 + (mods.shift ? 1 : 0) + (mods.alt ? 2 : 0) + (mods.ctrl ? 4 : 0);
}

export function encodeSpecial(key: SpecialKey, mods: Modifiers, appCursor: boolean): string {
    const prefix = mods.alt ? "\x1b" : "";
    switch (key) {
        case "Esc":
            return prefix + "\x1b";
        case "Tab":
            return prefix + (mods.shift ? "\x1b[Z" : "\t");
    }

    const m = modifierParam(mods);
    if (key in TILDE_PARAMS) {
        const n = TILDE_PARAMS[key];
        return m > 1 ? `\x1b[${n};${m}~` : `\x1b[${n}~`;
    }
    const final = CURSOR_FINALS[key];
    if (m > 1) {
        return `\x1b[1;${m}${final}`;
    }
    return (appCursor ? "\x1bO" : "\x1b[") + final;
}
