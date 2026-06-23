import { describe, it, expect } from "vitest";
import { encodeChar, encodeSpecial } from "./key-encoder";

const none = { ctrl: false, alt: false, shift: false };

describe("encodeChar", () => {
    it("passes plain characters through unchanged", () => {
        expect(encodeChar("c", none)).toBe("c");
    });
    it("maps Ctrl+letter to its control code", () => {
        expect(encodeChar("c", { ...none, ctrl: true })).toBe("\x03");
        expect(encodeChar("a", { ...none, ctrl: true })).toBe("\x01");
        expect(encodeChar("C", { ...none, ctrl: true })).toBe("\x03");
    });
    it("maps Ctrl+space to NUL", () => {
        expect(encodeChar(" ", { ...none, ctrl: true })).toBe("\x00");
    });
    it("prefixes Alt with ESC", () => {
        expect(encodeChar("x", { ...none, alt: true })).toBe("\x1bx");
    });
    it("uppercases with Shift", () => {
        expect(encodeChar("a", { ...none, shift: true })).toBe("A");
    });
    it("combines Ctrl+Alt (ESC then control code)", () => {
        expect(encodeChar("a", { ...none, ctrl: true, alt: true })).toBe("\x1b\x01");
    });
    it("maps Ctrl+symbol into the C0 control range", () => {
        expect(encodeChar("[", { ...none, ctrl: true })).toBe("\x1b");
        expect(encodeChar("]", { ...none, ctrl: true })).toBe("\x1d");
    });
});

describe("encodeSpecial", () => {
    it("returns the base sequence for a known key", () => {
        expect(encodeSpecial("Esc", none)).toBe("\x1b");
        expect(encodeSpecial("Tab", none)).toBe("\x09");
        expect(encodeSpecial("Up", none)).toBe("\x1b[A");
    });
    it("uses the shifted sequence when Shift is armed", () => {
        expect(encodeSpecial("Tab", { ...none, shift: true })).toBe("\x1b[Z");
        expect(encodeSpecial("Up", { ...none, shift: true })).toBe("\x1b[1;2A");
    });
    it("prefixes specials with ESC when Alt is armed", () => {
        expect(encodeSpecial("Left", { ...none, alt: true })).toBe("\x1b\x1b[D");
    });
    it("returns empty string for an unknown key", () => {
        expect(encodeSpecial("Nope", none)).toBe("");
    });
    it("encodes Backspace as DEL and Enter as CR", () => {
        expect(encodeSpecial("Backspace", none)).toBe("\x7f");
        expect(encodeSpecial("Enter", none)).toBe("\r");
    });
});
