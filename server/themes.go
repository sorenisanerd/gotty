package server

// Built-in terminal color themes.
// Each theme maps xterm.js ITheme fields to color values.
// Users select a theme by name in their config: preferences { theme = "nord" }
// Individual color overrides on top of the theme are supported.

var builtinThemes = map[string]map[string]string{
	// "default": Catppuccin Mocha — warm, high-contrast, easy on the eyes
	"default": {
		"foreground":    "#cdd6f4",
		"background":    "#1e1e2e",
		"cursor":        "#f5e0dc",
		"cursorAccent":  "#1e1e2e",
		"selection":     "#585b70",
		"black":         "#45475a",
		"red":           "#f38ba8",
		"green":         "#a6e3a1",
		"yellow":        "#f9e2af",
		"blue":          "#89b4fa",
		"magenta":       "#f5c2e7",
		"cyan":          "#94e2d5",
		"white":         "#bac2de",
		"brightBlack":   "#585b70",
		"brightRed":     "#f38ba8",
		"brightGreen":   "#a6e3a1",
		"brightYellow":  "#f9e2af",
		"brightBlue":    "#89b4fa",
		"brightMagenta": "#f5c2e7",
		"brightCyan":    "#94e2d5",
		"brightWhite":   "#a6adc8",
	},

	// "nord": Arctic, bluish-cold palette
	"nord": {
		"foreground":    "#d8dee9",
		"background":    "#2e3440",
		"cursor":        "#88c0d0",
		"cursorAccent":  "#2e3440",
		"selection":     "#434c5e",
		"black":         "#3b4252",
		"red":           "#bf616a",
		"green":         "#a3be8c",
		"yellow":        "#ebcb8b",
		"blue":          "#81a1c1",
		"magenta":       "#b48ead",
		"cyan":          "#88c0d0",
		"white":         "#e5e9f0",
		"brightBlack":   "#4c566a",
		"brightRed":     "#bf616a",
		"brightGreen":   "#a3be8c",
		"brightYellow":  "#ebcb8b",
		"brightBlue":    "#81a1c1",
		"brightMagenta": "#b48ead",
		"brightCyan":    "#8fbcbb",
		"brightWhite":   "#eceff4",
	},

	// "dracula": Dark purple-based high-contrast theme
	"dracula": {
		"foreground":    "#f8f8f2",
		"background":    "#282a36",
		"cursor":        "#f8f8f2",
		"cursorAccent":  "#282a36",
		"selection":     "#44475a",
		"black":         "#21222c",
		"red":           "#ff5555",
		"green":         "#50fa7b",
		"yellow":        "#f1fa8c",
		"blue":          "#bd93f9",
		"magenta":       "#ff79c6",
		"cyan":          "#8be9fd",
		"white":         "#f8f8f2",
		"brightBlack":   "#6272a4",
		"brightRed":     "#ff6e6e",
		"brightGreen":   "#69ff94",
		"brightYellow":  "#ffffa5",
		"brightBlue":    "#d6acff",
		"brightMagenta": "#ff92df",
		"brightCyan":    "#a4ffff",
		"brightWhite":   "#ffffff",
	},

	// "solarized-dark": Classic solarized dark
	"solarized-dark": {
		"foreground":    "#839496",
		"background":    "#002b36",
		"cursor":        "#93a1a1",
		"cursorAccent":  "#002b36",
		"selection":     "#073642",
		"black":         "#073642",
		"red":           "#dc322f",
		"green":         "#859900",
		"yellow":        "#b58900",
		"blue":          "#268bd2",
		"magenta":       "#d33682",
		"cyan":          "#2aa198",
		"white":         "#eee8d5",
		"brightBlack":   "#002b36",
		"brightRed":     "#cb4b16",
		"brightGreen":   "#586e75",
		"brightYellow":  "#657b83",
		"brightBlue":    "#839496",
		"brightMagenta": "#6c71c4",
		"brightCyan":    "#93a1a1",
		"brightWhite":   "#fdf6e3",
	},

	// "monokai": High-contrast vivid theme
	"monokai": {
		"foreground":    "#f8f8f2",
		"background":    "#272822",
		"cursor":        "#f8f8f0",
		"cursorAccent":  "#272822",
		"selection":     "#49483e",
		"black":         "#272822",
		"red":           "#f92672",
		"green":         "#a6e22e",
		"yellow":        "#f4bf75",
		"blue":          "#66d9ef",
		"magenta":       "#ae81ff",
		"cyan":          "#a1efe4",
		"white":         "#f8f8f2",
		"brightBlack":   "#75715e",
		"brightRed":     "#f92672",
		"brightGreen":   "#a6e22e",
		"brightYellow":  "#f4bf75",
		"brightBlue":    "#66d9ef",
		"brightMagenta": "#ae81ff",
		"brightCyan":    "#a1efe4",
		"brightWhite":   "#f9f8f5",
	},

	// "light": Clean light theme
	"light": {
		"foreground":    "#383a42",
		"background":    "#fafafa",
		"cursor":        "#526eff",
		"cursorAccent":  "#fafafa",
		"selection":     "#e5e5e5",
		"black":         "#383a42",
		"red":           "#e45649",
		"green":         "#50a14f",
		"yellow":        "#c18401",
		"blue":          "#0184bc",
		"magenta":       "#a626a4",
		"cyan":          "#0997b3",
		"white":         "#f0f0f0",
		"brightBlack":   "#696c77",
		"brightRed":     "#e45649",
		"brightGreen":   "#50a14f",
		"brightYellow":  "#c18401",
		"brightBlue":    "#0184bc",
		"brightMagenta": "#a626a4",
		"brightCyan":    "#0997b3",
		"brightWhite":   "#ffffff",
	},
}

// resolveTheme returns a theme color map based on the user's config.
// If a named theme is specified and it exists, it's used as the base.
// If the theme is "custom" or unknown, an empty map is returned (no base).
// Individual color overrides are applied on top in buildPreferences.
func resolveTheme(theme string) map[string]string {
	if t, ok := builtinThemes[theme]; ok {
		result := make(map[string]string, len(t))
		for k, v := range t {
			result[k] = v
		}
		return result
	}
	return make(map[string]string)
}