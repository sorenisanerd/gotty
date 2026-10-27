// Detects the on-screen keyboard and the part of the page left visible
// above it. Neither iOS Safari nor Android Chrome (108+) shrink the layout
// viewport when the keyboard opens; both shrink window.visualViewport, so
// compare the two.

// A shrink smaller than this is browser chrome (e.g. the URL bar), not a
// keyboard. Pinch-zoom also shrinks the visual viewport, by 1/scale, so the
// comparison undoes the zoom first.
export const KEYBOARD_MIN_HEIGHT = 150;

export interface VisibleArea {
    keyboardOpen: boolean;
    // Top of the visible area in layout-viewport pixels; non-zero when the
    // browser has panned the page to keep the focused input in view.
    top: number;
    height: number;
    // Height covered at the bottom of the layout viewport, i.e. the keyboard.
    bottomInset: number;
}

export function computeVisibleArea(
    layoutHeight: number,
    vv: { height: number; offsetTop: number; scale: number },
    inputFocused: boolean,
): VisibleArea {
    return {
        keyboardOpen: inputFocused && layoutHeight - vv.height * vv.scale > KEYBOARD_MIN_HEIGHT,
        top: vv.offsetTop,
        height: vv.height,
        bottomInset: Math.max(0, layoutHeight - (vv.offsetTop + vv.height)),
    };
}

// Report the visible area whenever the viewport or the input's focus
// changes. A keyboard only counts while `input` has focus, so a hardware
// keyboard (focused, no shrink) never does. Returns an unsubscribe function.
export function watchVisibleArea(
    input: HTMLElement,
    vv: VisualViewport,
    onChange: (area: VisibleArea) => void,
): () => void {
    let focused = document.activeElement === input;
    const update = () => onChange(computeVisibleArea(window.innerHeight, vv, focused));
    const onFocus = () => { focused = true; update(); };
    const onBlur = () => { focused = false; update(); };

    input.addEventListener("focus", onFocus);
    input.addEventListener("blur", onBlur);
    vv.addEventListener("resize", update);
    vv.addEventListener("scroll", update);
    return () => {
        input.removeEventListener("focus", onFocus);
        input.removeEventListener("blur", onBlur);
        vv.removeEventListener("resize", update);
        vv.removeEventListener("scroll", update);
    };
}
