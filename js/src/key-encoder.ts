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
    Backspace: { seq: "\x7f" },
    Enter: { seq: "\r" },
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
