// Theme + font picker — a floating palette button that lets users switch
// themes, font size, and font family at runtime. All choices are persisted
// to localStorage and restored on page load.

import { Terminal } from "@xterm/xterm";

// The global populated by /themes.js
interface ThemeMap {
    [name: string]: { [colorKey: string]: string };
}

const STORAGE_THEME = "gotty-theme";
const STORAGE_FONT_SIZE = "gotty-font-size";
const STORAGE_FONT_FAMILY = "gotty-font-family";

const FONT_SIZES = [10, 12, 14, 16, 18, 20, 24];

interface FontFamilyOption {
    name: string;
    value: string;
}

const FONT_FAMILIES: FontFamilyOption[] = [
    { name: "DejaVu Sans Mono", value: "'DejaVu Sans Mono', monospace" },
    { name: "JetBrains Mono", value: "'JetBrains Mono', monospace" },
    { name: "Fira Code", value: "'Fira Code', monospace" },
    { name: "Source Code Pro", value: "'Source Code Pro', monospace" },
    { name: "Monaco", value: "Monaco, monospace" },
    { name: "Menlo", value: "Menlo, monospace" },
    { name: "Cascadia Code", value: "'Cascadia Code', monospace" },
    { name: "monospace", value: "monospace" },
];

// Helper: map a theme name to a friendly display label
function themeLabel(name: string): string {
    const labels: { [key: string]: string } = {
        "default": "Default",
        "nord": "Nord",
        "dracula": "Dracula",
        "solarized-dark": "Solarized Dark",
        "monokai": "Monokai",
        "light": "Light",
    };
    return labels[name] || name;
}

// Apply a theme's color map to an xterm.js terminal
function applyTheme(term: Terminal | undefined, colors: { [key: string]: string } | undefined) {
    if (term && colors) {
        term.options.theme = colors as any;
    }
}

// Apply stored font settings
function applyFontPrefs(term: Terminal | undefined) {
    if (!term) return;
    const fs = localStorage.getItem(STORAGE_FONT_SIZE);
    if (fs) {
        const n = parseInt(fs, 10);
        if (!isNaN(n) && n >= 8 && n <= 48) {
            term.options.fontSize = n;
        }
    }
    const ff = localStorage.getItem(STORAGE_FONT_FAMILY);
    if (ff) {
        term.options.fontFamily = ff;
    }
}

// Build the picker UI and attach it to the page
export function initThemePicker(term?: Terminal): void {
    const themes = (window as any).gotty_themes as ThemeMap | undefined;
    if (!themes) return;

    const names = Object.keys(themes);

    // --- Styles ---
    const style = document.createElement("style");
    style.textContent = `
#gotty-theme-btn {
    position: fixed;
    bottom: 12px;
    right: 12px;
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
    transition: background 0.2s, transform 0.2s;
    backdrop-filter: blur(4px);
    line-height: 1;
}
#gotty-theme-btn:hover {
    background: rgba(0,0,0,0.75);
    transform: scale(1.1);
}
#gotty-theme-picker {
    position: fixed;
    bottom: 54px;
    right: 12px;
    z-index: 9999;
    display: none;
    min-width: 190px;
    max-height: 70vh;
    overflow-y: auto;
}
#gotty-theme-picker.open {
    display: block;
}
#gotty-theme-picker::-webkit-scrollbar {
    width: 4px;
}
#gotty-theme-picker::-webkit-scrollbar-track {
    background: transparent;
}
#gotty-theme-picker::-webkit-scrollbar-thumb {
    background: rgba(255,255,255,0.15);
    border-radius: 2px;
}
#gotty-theme-picker .panel {
    background: rgba(30,30,30,0.92);
    backdrop-filter: blur(8px);
    border: 1px solid rgba(255,255,255,0.12);
    border-radius: 10px;
    padding: 6px;
    box-shadow: 0 8px 24px rgba(0,0,0,0.5);
}
#gotty-theme-picker .section-title {
    font-size: 10px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.8px;
    color: rgba(255,255,255,0.35);
    padding: 10px 10px 6px;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
}
#gotty-theme-picker .section-title:first-child {
    padding-top: 4px;
}
#gotty-theme-picker .section-divider {
    height: 1px;
    background: rgba(255,255,255,0.08);
    margin: 4px 10px;
}
#gotty-theme-picker .theme-item {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 8px 10px;
    border-radius: 6px;
    cursor: pointer;
    color: #ccc;
    font-size: 13px;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    transition: background 0.15s;
}
#gotty-theme-picker .theme-item:hover {
    background: rgba(255,255,255,0.08);
    color: #fff;
}
#gotty-theme-picker .theme-item.active {
    color: #fff;
    background: rgba(255,255,255,0.12);
}
#gotty-theme-picker .theme-swatch {
    width: 20px;
    height: 20px;
    border-radius: 50%;
    flex-shrink: 0;
    border: 2px solid rgba(255,255,255,0.15);
}
#gotty-theme-picker .theme-name {
    flex: 1;
}

/* Font size row */
#gotty-theme-picker .font-size-row {
    display: flex;
    gap: 4px;
    padding: 2px 10px 8px;
    flex-wrap: wrap;
}
#gotty-theme-picker .size-btn {
    flex: 1;
    min-width: 28px;
    height: 26px;
    border-radius: 5px;
    border: 1px solid rgba(255,255,255,0.1);
    background: transparent;
    color: #bbb;
    font-size: 11px;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    cursor: pointer;
    transition: all 0.15s;
    padding: 0 4px;
    text-align: center;
    line-height: 26px;
}
#gotty-theme-picker .size-btn:hover {
    background: rgba(255,255,255,0.08);
    color: #fff;
}
#gotty-theme-picker .size-btn.active {
    background: rgba(255,255,255,0.15);
    color: #fff;
    border-color: rgba(255,255,255,0.3);
}

/* Font family items */
#gotty-theme-picker .font-family-item {
    padding: 7px 10px;
    border-radius: 6px;
    cursor: pointer;
    color: #ccc;
    font-size: 13px;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    transition: background 0.15s;
    display: flex;
    align-items: center;
    gap: 8px;
    margin: 0 0 1px;
}
#gotty-theme-picker .font-family-item:hover {
    background: rgba(255,255,255,0.08);
    color: #fff;
}
#gotty-theme-picker .font-family-item.active {
    color: #fff;
    background: rgba(255,255,255,0.12);
}
#gotty-theme-picker .font-family-preview {
    font-size: 14px;
    flex: 1;
}
#gotty-theme-picker .font-family-check {
    color: #4ade80;
    font-size: 12px;
    visibility: hidden;
}
#gotty-theme-picker .font-family-item.active .font-family-check {
    visibility: visible;
}
`;

    document.head.appendChild(style);

    // --- Button ---
    const btn = document.createElement("button");
    btn.id = "gotty-theme-btn";
    btn.textContent = "🎨";
    btn.title = "Display settings";
    document.body.appendChild(btn);

    // --- Dropdown ---
    const container = document.createElement("div");
    container.id = "gotty-theme-picker";

    const panel = document.createElement("div");
    panel.className = "panel";

    let activeThemeName = localStorage.getItem(STORAGE_THEME) || "";
    let activeFontSize = localStorage.getItem(STORAGE_FONT_SIZE) || "";
    let activeFontFamily = localStorage.getItem(STORAGE_FONT_FAMILY) || "";

    // Restore saved preferences on load
    if (activeThemeName && themes[activeThemeName]) {
        applyTheme(term, themes[activeThemeName]);
    }
    applyFontPrefs(term);

    // ── Themes section ──
    const themeTitle = document.createElement("div");
    themeTitle.className = "section-title";
    themeTitle.textContent = "Themes";
    panel.appendChild(themeTitle);

    for (const name of names) {
        const colors = themes[name];
        const item = document.createElement("div");
        item.className = "theme-item";
        if (name === activeThemeName) {
            item.classList.add("active");
        }

        const swatch = document.createElement("div");
        swatch.className = "theme-swatch";
        swatch.style.background = colors?.background || "#333";
        item.appendChild(swatch);

        const label = document.createElement("span");
        label.className = "theme-name";
        label.textContent = themeLabel(name);
        item.appendChild(label);

        if (name === activeThemeName) {
            const check = document.createElement("span");
            check.textContent = "✓";
            check.style.color = "#4ade80";
            item.appendChild(check);
        }

        item.addEventListener("click", () => {
            applyTheme(term, colors);
            localStorage.setItem(STORAGE_THEME, name);
            // Update active state
            container.querySelectorAll(".theme-item").forEach((el) => {
                el.classList.remove("active");
                const last = el.lastChild;
                if (last && last.textContent === "✓") {
                    el.removeChild(last);
                }
            });
            item.classList.add("active");
            const check = document.createElement("span");
            check.textContent = "✓";
            check.style.color = "#4ade80";
            item.appendChild(check);
            // Don't close — let user tweak fonts too
        });

        panel.appendChild(item);
    }

    // ── Divider ──
    const divider = document.createElement("div");
    divider.className = "section-divider";
    panel.appendChild(divider);

    // ── Font Size section ──
    const sizeTitle = document.createElement("div");
    sizeTitle.className = "section-title";
    sizeTitle.textContent = "Font Size";
    panel.appendChild(sizeTitle);

    const sizeRow = document.createElement("div");
    sizeRow.className = "font-size-row";

    const savedSize = activeFontSize ? parseInt(activeFontSize, 10) : null;
    const currentSize = (savedSize && !isNaN(savedSize)) ? savedSize : (term?.options?.fontSize || 14);

    for (const sz of FONT_SIZES) {
        const sb = document.createElement("button");
        sb.className = "size-btn";
        sb.textContent = String(sz);
        if (sz === currentSize) {
            sb.classList.add("active");
        }
        sb.addEventListener("click", () => {
            if (term) {
                term.options.fontSize = sz;
            }
            localStorage.setItem(STORAGE_FONT_SIZE, String(sz));
            sizeRow.querySelectorAll(".size-btn").forEach((el) => el.classList.remove("active"));
            sb.classList.add("active");
        });
        sizeRow.appendChild(sb);
    }

    panel.appendChild(sizeRow);

    // ── Font Family section ──
    const ffTitle = document.createElement("div");
    ffTitle.className = "section-title";
    ffTitle.textContent = "Font Family";
    panel.appendChild(ffTitle);

    const currentFF = activeFontFamily || term?.options?.fontFamily || "";

    for (const ff of FONT_FAMILIES) {
        const item = document.createElement("div");
        item.className = "font-family-item";
        if (ff.value === currentFF) {
            item.classList.add("active");
        }

        const preview = document.createElement("span");
        preview.className = "font-family-preview";
        preview.textContent = ff.name;
        preview.style.fontFamily = ff.value;
        item.appendChild(preview);

        const check = document.createElement("span");
        check.className = "font-family-check";
        check.textContent = "✓";
        item.appendChild(check);

        item.addEventListener("click", () => {
            if (term) {
                term.options.fontFamily = ff.value;
            }
            localStorage.setItem(STORAGE_FONT_FAMILY, ff.value);
            panel.querySelectorAll(".font-family-item").forEach((el) => {
                el.classList.remove("active");
            });
            item.classList.add("active");
        });

        panel.appendChild(item);
    }

    container.appendChild(panel);
    document.body.appendChild(container);

    // --- Toggle ---
    btn.addEventListener("click", (e) => {
        e.stopPropagation();
        container.classList.toggle("open");
    });

    // Close on outside click
    document.addEventListener("click", (e) => {
        if (!container.contains(e.target as Node) && e.target !== btn) {
            container.classList.remove("open");
        }
    });
}
