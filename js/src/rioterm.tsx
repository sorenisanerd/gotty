import { open, defaultTheme, type RioTermHandle, type Theme } from "rioterm";
import { ZModemAddon } from "./zmodem";

/*
 * Appearance state the terminal is opened with. rioterm takes options at
 * open(); live changes (theme picker, server SetPreferences) re-open the
 * renderer and replay the buffer via serialize(), which preserves
 * scrollback, styles, and hyperlinks.
 */
interface Appearance {
    fontFamily: string;
    fontSize: number;
    cursorStyle: "block" | "underline" | "bar";
    scrollback: number;
    theme: Theme;
}

export class GoTTYRioterm {
    // The HTMLElement that contains our terminal
    elem: HTMLElement;

    handle!: RioTermHandle;

    message: HTMLElement;
    messageTimeout: number;
    messageTimer!: NodeJS.Timeout;

    zmodemAddon: ZModemAddon;
    toServer!: (data: string | Uint8Array) => void;
    resizeCallback?: (columns: number, rows: number) => void;
    encoder: TextEncoder;
    altIsMeta: boolean = false;
    stdinEnabled: boolean = true;
    inputActive: boolean = true;

    appearance: Appearance = {
        fontFamily: "monospace",
        fontSize: 14,
        cursorStyle: "block",
        scrollback: 10000,
        theme: defaultTheme,
    };

    resizeListener: () => void;
    altIsMetaListener: (event: KeyboardEvent) => void;

    private constructor(elem: HTMLElement) {
        this.elem = elem;
        this.encoder = new TextEncoder();

        this.zmodemAddon = new ZModemAddon({
            toTerminal: (x: Uint8Array) => this.handle.terminal.write(x),
            toServer: (x: Uint8Array) => this.sendInput(x),
            setStdinEnabled: (enabled: boolean) => {
                this.stdinEnabled = enabled;
            },
            focus: () => this.focus(),
        });

        this.message = elem.ownerDocument.createElement("div");
        this.message.className = "xterm-overlay";
        this.messageTimeout = 2000;

        this.resizeListener = () => {
            this.fit();
        };
        this.altIsMetaListener = (event: KeyboardEvent) => this.handleAltIsMeta(event);
    }

    static async create(elem: HTMLElement, preferences: Record<string, unknown> = {}): Promise<GoTTYRioterm> {
        const term = new GoTTYRioterm(elem);
        term.applyPreferenceValues(preferences);
        await term.openTerminal();
        term.focus();
        term.fit();

        window.addEventListener("resize", term.resizeListener);
        elem.addEventListener("keydown", term.altIsMetaListener, true);
        return term;
    }

    private async openTerminal(replay?: string) {
        this.handle = await open(this.elem, {
            renderer: "canvas",
            fit: false, // sized by fit() below so resizes can be announced
            fontFamily: this.appearance.fontFamily,
            fontSize: this.appearance.fontSize,
            cursorStyle: this.appearance.cursorStyle,
            scrollback: this.appearance.scrollback,
            theme: this.appearance.theme,
        });
        this.handle.terminal.onData((input: Uint8Array) => {
            if (!this.stdinEnabled || !this.inputActive) {
                return;
            }
            this.toServer?.(input);
        });
        if (replay) {
            this.handle.terminal.write(replay);
            this.scrollToBottom();
        }
    }

    /*
     * Re-open the renderer with the current appearance, replaying the
     * buffer so theme and font changes keep scrollback intact.
     */
    private async reopen() {
        if (!this.handle) {
            return;
        }
        const replay = this.handle.terminal.serialize();
        this.handle.dispose();
        await this.openTerminal(replay);
        this.fit();
        this.focus();
    }

    private fit() {
        if (!this.handle) {
            return;
        }
        const before = this.info();
        this.handle.renderer.fit(this.elem.clientWidth, this.elem.clientHeight);
        const after = this.info();
        this.scrollToBottom();
        if (after.columns !== before.columns || after.rows !== before.rows) {
            this.resizeCallback?.(after.columns, after.rows);
            this.showMessage(String(after.columns) + "x" + String(after.rows), this.messageTimeout);
        }
    }

    private scrollToBottom() {
        const terminal = this.handle.terminal;
        terminal.scrollLines(-terminal.historySize());
    }

    info(): { columns: number, rows: number } {
        return {
            columns: this.handle.terminal.options.cols,
            rows: this.handle.terminal.options.rows,
        };
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
        const changed = this.applyPreferenceValues(value);
        if (changed && this.handle) {
            void this.reopen();
        }
    };

    /*
     * Merge preference values into the appearance state. Returns whether
     * anything the renderer was opened with changed.
     */
    private applyPreferenceValues(value: Record<string, unknown>): boolean {
        let changed = false;
        for (const key of Object.keys(value)) {
            switch (key) {
                case "font-family":
                    this.appearance.fontFamily = value[key] as string;
                    changed = true;
                    break;
                case "font-size":
                    this.appearance.fontSize = value[key] as number;
                    changed = true;
                    break;
                case "cursor-style":
                    this.appearance.cursorStyle = value[key] as "block" | "underline" | "bar";
                    changed = true;
                    break;
                case "scrollback-lines":
                    this.appearance.scrollback = value[key] as number;
                    changed = true;
                    break;
                case "theme":
                    this.appearance.theme = {
                        ...defaultTheme,
                        ...(value[key] as Partial<Theme>),
                    };
                    changed = true;
                    break;
                case "alt-is-meta":
                    this.altIsMeta = value[key] as boolean;
                    break;
                case "EnableWebGL":
                    // The engine parses in wasm and paints on a 2D canvas;
                    // there is no WebGL context to enable.
                    break;
                case "cursor-blink":
                    // Not supported by the renderer yet.
                    break;
            }
        }
        return changed;
    }

    private handleAltIsMeta(event: KeyboardEvent) {
        if (!this.altIsMeta) return;

        // Only handle Alt+key without Ctrl/Meta
        if (!event.altKey || event.ctrlKey || event.metaKey) return;

        // Skip special keys that should be handled by the browser
        // (Tab, arrows, function keys, etc.)
        if (event.code.startsWith('Alt') || event.code === 'Tab') return;

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
            // Capture phase: stop the event before the terminal's own
            // keyboard handler encodes it a second time.
            event.preventDefault();
            event.stopPropagation();
            this.toServer(this.encoder.encode('\x1b' + char));
        }
    };

    sendInput(data: Uint8Array) {
        return this.toServer(data)
    }

    onInput(callback: (input: string | Uint8Array) => void) {
        this.toServer = callback;
        this.inputActive = true;
    };

    onResize(callback: (columns: number, rows: number) => void) {
        this.resizeCallback = callback;
    };

    deactivate(): void {
        this.inputActive = false;
        const active = document.activeElement;
        if (active instanceof HTMLElement && this.elem.contains(active)) {
            active.blur();
        }
    }

    reset(): void {
        this.removeMessage();
        // Clear screen and scrollback, park the cursor at home.
        this.handle.terminal.write('\x1b[2J\x1b[3J\x1b[H');
    }

    close(): void {
        window.removeEventListener("resize", this.resizeListener);
        this.elem.removeEventListener("keydown", this.altIsMetaListener, true);
        this.handle.dispose();
    }

    disableStdin(): void {
        this.stdinEnabled = false;
    }

    enableStdin(): void {
        this.stdinEnabled = true;
    }

    focus(): void {
        this.handle.focus();
    }
}
