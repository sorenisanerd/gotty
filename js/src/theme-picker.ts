// Theme picker UI — a floating palette button that lets users switch themes at runtime.
// Choices are persisted to localStorage and restored on page load.

import { Terminal } from "@xterm/xterm";

// The global populated by /themes.js
interface ThemeMap {
    [name: string]: { [colorKey: string]: string };
}

const STORAGE_KEY = "gotty-theme";

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

// Build the theme picker UI and attach it to the page
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
    min-width: 160px;
}
#gotty-theme-picker.open {
    display: block;
}
#gotty-theme-picker .panel {
    background: rgba(30,30,30,0.92);
    backdrop-filter: blur(8px);
    border: 1px solid rgba(255,255,255,0.12);
    border-radius: 10px;
    padding: 6px;
    box-shadow: 0 8px 24px rgba(0,0,0,0.5);
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
`;
    document.head.appendChild(style);

    // --- Button ---
    const btn = document.createElement("button");
    btn.id = "gotty-theme-btn";
    btn.textContent = "🎨";
    btn.title = "Switch theme";
    document.body.appendChild(btn);

    // --- Dropdown ---
    const container = document.createElement("div");
    container.id = "gotty-theme-picker";

    const panel = document.createElement("div");
    panel.className = "panel";

    let activeName = localStorage.getItem(STORAGE_KEY) || "";

    // Restore saved theme on load
    if (activeName && themes[activeName]) {
        applyTheme(term, themes[activeName]);
    }

    for (const name of names) {
        const colors = themes[name];
        const item = document.createElement("div");
        item.className = "theme-item";
        if (name === activeName) {
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

        if (name === activeName) {
            const check = document.createElement("span");
            check.textContent = "✓";
            check.style.color = "#4ade80";
            item.appendChild(check);
        }

        item.addEventListener("click", () => {
            applyTheme(term, colors);
            localStorage.setItem(STORAGE_KEY, name);
            // Update active state
            container.querySelectorAll(".theme-item").forEach((el) => {
                el.classList.remove("active");
                if (el.lastChild?.textContent === "✓") {
                    el.removeChild(el.lastChild);
                }
            });
            item.classList.add("active");
            const check = document.createElement("span");
            check.textContent = "✓";
            check.style.color = "#4ade80";
            item.appendChild(check);
            // Close after selection
            container.classList.remove("open");
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