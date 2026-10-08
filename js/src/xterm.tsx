import { IDisposable, Terminal } from "@xterm/xterm";
import { Unicode11Addon } from '@xterm/addon-unicode11';
import { FitAddon } from '@xterm/addon-fit';
import { WebLinksAddon } from '@xterm/addon-web-links';
import { WebglAddon } from '@xterm/addon-webgl';
import { ImageAddon } from '@xterm/addon-image';
import { ZModemAddon } from "./zmodem";

export class GoTTYXterm {
    // The HTMLElement that contains our terminal
    elem: HTMLElement;

    // The xtermjs.XTerm
    term: Terminal;

    resizeListener: () => void;

    message: HTMLElement;
    messageTimeout: number;
    messageTimer!: NodeJS.Timeout;

    onResizeHandler!: IDisposable;
    onDataHandler!: IDisposable;

    fitAddOn: FitAddon;
    zmodemAddon: ZModemAddon;
    toServer!: (data: string | Uint8Array) => void;
    encoder: TextEncoder;
    altIsMeta: boolean = false;

    constructor(elem: HTMLElement, preferences: Record<string, unknown> = {}) {
        this.elem = elem;
        this.encoder = new TextEncoder();
        this.term = new Terminal({
            allowProposedApi: true,
            customGlyphs: true,
            rescaleOverlappingGlyphs: true,
        });

        const unicode11Addon = new Unicode11Addon();
        this.term.loadAddon(unicode11Addon);
        this.term.unicode.activeVersion = '11';

        this.setPreferences(preferences);

        this.fitAddOn = new FitAddon();
        this.zmodemAddon = new ZModemAddon({
            toTerminal: (x: Uint8Array) => this.term.write(x),
            toServer: (x: Uint8Array) => this.sendInput(x)
        });
        this.term.loadAddon(new WebLinksAddon());
        this.term.loadAddon(this.fitAddOn);
        this.term.loadAddon(new ImageAddon());
        this.term.loadAddon(this.zmodemAddon);

        this.message = elem.ownerDocument.createElement("div");
        this.message.className = "xterm-overlay";
        this.messageTimeout = 2000;

        this.resizeListener = () => {
            this.fitAddOn.fit();
            this.term.scrollToBottom();
            this.showMessage(String(this.term.cols) + "x" + String(this.term.rows), this.messageTimeout);
        };

        this.term.open(elem);

        try {
            this.term.loadAddon(new WebglAddon());
        } catch (e) {
            console.warn("WebGL renderer failed to load, using canvas fallback", e);
        }

        this.term.focus();
        this.resizeListener();

        // Pre-register the alt_is_meta handler; it's a no-op unless altIsMeta is true.
        this.setupAltIsMeta();

        this.setupOsc52();

        window.addEventListener("resize", () => { this.resizeListener(); });
    };

    info(): { columns: number, rows: number } {
        return { columns: this.term.cols, rows: this.term.rows };
    };

    // This gets called from the Websocket's onReceive handler
    output(data: Uint8Array) {
        this.zmodemAddon.consume(data);
    };

    getMessage(): HTMLElement {
        return this.message;
    }

    showMessage(message: string, timeout: number) {
        this.message.innerHTML = message;
        this.showMessageElem(timeout);
    }

    showMessageElem(timeout: number) {
        this.elem.appendChild(this.message);

        if (this.messageTimer) {
            clearTimeout(this.messageTimer);
        }
        if (timeout > 0) {
            this.messageTimer = setTimeout(() => {
                try {
                    this.elem.removeChild(this.message);
                } catch (error) {
                    console.error(error);
                }
            }, timeout);
        }
    };

    removeMessage(): void {
        if (this.message.parentNode == this.elem) {
            this.elem.removeChild(this.message);
        }
    }

    setWindowTitle(title: string) {
        document.title = title;
    };

    setPreferences(value?: Record<string, unknown> | null) {
        if (!value) {
            return;
        }

        // Apply font settings first so the renderer initializes with the
        // correct font metrics before any renderer-specific logic.
        const keys = Object.keys(value);
        const fontKeys = keys.filter(k => k === "font-family" || k === "font-size");
        const otherKeys = keys.filter(k => k !== "font-family" && k !== "font-size");

        for (const key of [...fontKeys, ...otherKeys]) {
            switch (key) {
                case "font-family":
                    this.term.options.fontFamily = value[key] as string;
                    break;
                case "font-size":
                    this.term.options.fontSize = value[key] as number;
                    break;
                case "EnableWebGL":
                    // Already loaded by default in constructor — skip to avoid
                    // orphaning the first WebglAddon with a duplicate.
                    break;
                case "cursor-blink":
                    this.term.options.cursorBlink = value[key] as boolean;
                    break;
                case "cursor-style":
                    this.term.options.cursorStyle = value[key] as "block" | "underline" | "bar";
                    break;
                case "scrollback-lines":
                    this.term.options.scrollback = value[key] as number;
                    break;
                case "theme":
                    this.term.options.theme = value[key] as object;
                    break;
                case "alt-is-meta":
                    this.altIsMeta = value[key] as boolean;
                    break;
            }
        }
    };

    setupAltIsMeta() {
        this.term.attachCustomKeyEventHandler((event: KeyboardEvent) => {
            if (!this.altIsMeta) return true;

            // Only handle Alt+key without Ctrl/Meta
            if (!event.altKey || event.ctrlKey || event.metaKey) return true;

            // Skip special keys that should be handled by the browser
            // (Tab, arrows, function keys, etc.)
            if (event.code.startsWith('Alt') || event.code === 'Tab') return true;

            // Determine the character to send with the Escape prefix
            let char: string | null = null;

            if (event.code.startsWith('Key') && event.code.length === 4) {
                // Letter keys: use event.code to get the base character,
                // which works correctly on macOS where Option composes characters
                const letter = event.code[3];
                char = event.shiftKey ? letter : letter.toLowerCase();
            } else if (event.code.startsWith('Digit') && event.code.length === 6) {
                // Digit keys: handle unshifted digits and shifted symbols
                const digit = event.code[5];
                if (!event.shiftKey) {
                    char = digit;
                } else {
                    // Shifted digit keys produce symbols; use event.key
                    if (event.key.length === 1) {
                        char = event.key;
                    }
                }
            } else if (event.key === ' ') {
                // Alt+Space -> M-SPC
                char = ' ';
            } else if (event.key.length === 1 && event.key !== ' ') {
                // Other single-character keys (., /, ;, ', [, ], etc.)
                char = event.key;
            }

            if (char !== null) {
                event.preventDefault();
                this.toServer(this.encoder.encode('\x1b' + char));
                return false;
            }

            return true;
        });
    };

    setupOsc52() {
        const fallbackCopy = (text: string) => {
            const sel = document.getSelection();
            const ranges: Range[] = [];
            if (sel) for (let i = 0; i < sel.rangeCount; i++) ranges.push(sel.getRangeAt(i));
            const ta = document.createElement("textarea");
            ta.value = text;
            ta.setAttribute("readonly", "");
            ta.style.position = "fixed";
            ta.style.top = "-9999px";
            ta.style.left = "-9999px";
            document.body.appendChild(ta);
            ta.select();
            try { document.execCommand("copy"); } catch {}
            document.body.removeChild(ta);
            if (sel) {
                sel.removeAllRanges();
                for (const r of ranges) sel.addRange(r);
            }
            this.term.focus();
        };
        this.term.parser.registerOscHandler(52, (data: string) => {
            const semi = data.indexOf(";");
            const b64 = semi >= 0 ? data.slice(semi + 1) : data;
            if (b64.length === 0) return true;
            if (b64.charAt(b64.length - 1) === "?") return true;
            try {
                const bin = atob(b64);
                const bytes = new Uint8Array(bin.length);
                for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
                const text = new TextDecoder().decode(bytes);
                if (navigator.clipboard && navigator.clipboard.writeText) {
                    navigator.clipboard.writeText(text).catch(() => fallbackCopy(text));
                } else {
                    fallbackCopy(text);
                }
            } catch {}
            return true;
        });
    };

    sendInput(data: Uint8Array) {
        return this.toServer(data)
    }

    onInput(callback: (input: string | Uint8Array) => void) {
        this.encoder = new TextEncoder()
        this.toServer = callback;

        // I *think* we're ok like this, but if not, we can dispose
        // of the previous handler and put the new one in place.
        if (this.onDataHandler !== undefined) {
            return
        }

        this.onDataHandler = this.term.onData((input) => {
            this.toServer(this.encoder.encode(input));
        });
    };

    onResize(callback: (colmuns: number, rows: number) => void) {
        this.onResizeHandler = this.term.onResize(() => {
            callback(this.term.cols, this.term.rows);
        });
    };

    deactivate(): void {
        this.onDataHandler.dispose();
        this.onResizeHandler.dispose();
        this.term.blur();
    }

    reset(): void {
        this.removeMessage();
        this.term.clear();
    }

    close(): void {
        window.removeEventListener("resize", this.resizeListener);
        this.term.dispose();
    }

    disableStdin(): void {
        this.term.options.disableStdin = true;
    }

    enableStdin(): void {
        this.term.options.disableStdin = false;
    }

    focus(): void {
        this.term.focus();
    }
}