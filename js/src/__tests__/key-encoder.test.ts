import { describe, expect, it } from "vitest";
import { encodeChar, encodeSpecial, NO_MODS } from "../key-encoder";

const C = { ...NO_MODS, ctrl: true };
const A = { ...NO_MODS, alt: true };
const S = { ...NO_MODS, shift: true };
const CA = { ...NO_MODS, ctrl: true, alt: true };
const CAS = { ctrl: true, alt: true, shift: true };

describe("encodeChar", () => {
  it("passes plain characters through", () => {
    expect(encodeChar("c", NO_MODS)).toBe("c");
  });

  it("maps Ctrl+letter to its control code, either case", () => {
    expect(encodeChar("c", C)).toBe("\x03");
    expect(encodeChar("C", C)).toBe("\x03");
    expect(encodeChar("b", C)).toBe("\x02");
  });

  it("maps Ctrl+symbol into the C0 range", () => {
    expect(encodeChar(" ", C)).toBe("\x00");
    expect(encodeChar("@", C)).toBe("\x00");
    expect(encodeChar("[", C)).toBe("\x1b");
    expect(encodeChar("\\", C)).toBe("\x1c");
    expect(encodeChar("]", C)).toBe("\x1d");
    expect(encodeChar("^", C)).toBe("\x1e");
    expect(encodeChar("_", C)).toBe("\x1f");
    expect(encodeChar("/", C)).toBe("\x1f");
    expect(encodeChar("?", C)).toBe("\x7f");
  });

  it("leaves characters without a control code unchanged under Ctrl", () => {
    expect(encodeChar("1", C)).toBe("1");
    expect(encodeChar("é", C)).toBe("é");
  });

  it("prefixes Alt with ESC", () => {
    expect(encodeChar("x", A)).toBe("\x1bx");
    expect(encodeChar("\x7f", A)).toBe("\x1b\x7f");
  });

  it("uppercases letters with Shift", () => {
    expect(encodeChar("a", S)).toBe("A");
  });

  it("combines Ctrl and Alt as ESC then the control code", () => {
    expect(encodeChar("a", CA)).toBe("\x1b\x01");
  });
});

describe("encodeSpecial", () => {
  it("sends Esc, with Alt as an ESC prefix and Ctrl ignored", () => {
    expect(encodeSpecial("Esc", NO_MODS, false)).toBe("\x1b");
    expect(encodeSpecial("Esc", A, false)).toBe("\x1b\x1b");
    expect(encodeSpecial("Esc", C, false)).toBe("\x1b");
  });

  it("sends Tab, back-tab with Shift, ESC-prefixed with Alt", () => {
    expect(encodeSpecial("Tab", NO_MODS, false)).toBe("\t");
    expect(encodeSpecial("Tab", S, false)).toBe("\x1b[Z");
    expect(encodeSpecial("Tab", A, false)).toBe("\x1b\t");
  });

  it("follows the cursor-key mode for unmodified arrows", () => {
    expect(encodeSpecial("Up", NO_MODS, false)).toBe("\x1b[A");
    expect(encodeSpecial("Up", NO_MODS, true)).toBe("\x1bOA");
  });

  it("uses the CSI 1;m form for modified arrows in either mode", () => {
    expect(encodeSpecial("Left", C, true)).toBe("\x1b[1;5D");
    expect(encodeSpecial("Right", S, false)).toBe("\x1b[1;2C");
    expect(encodeSpecial("Down", CAS, false)).toBe("\x1b[1;8B");
  });

  it("sends Home and End", () => {
    expect(encodeSpecial("Home", NO_MODS, false)).toBe("\x1b[H");
    expect(encodeSpecial("End", NO_MODS, true)).toBe("\x1bOF");
    expect(encodeSpecial("Home", C, false)).toBe("\x1b[1;5H");
  });

  it("sends PgUp and PgDn", () => {
    expect(encodeSpecial("PgUp", NO_MODS, false)).toBe("\x1b[5~");
    expect(encodeSpecial("PgDn", C, false)).toBe("\x1b[6;5~");
  });
});
