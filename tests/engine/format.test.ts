import { describe, expect, it } from "vitest";
import {
  formatEuro,
  formatMoneyInput,
  formatNumberInput,
  formatPercent,
  normalizeGermanNumber,
  parseGermanNumber,
  parseMoney,
} from "@/lib/engine/format";

describe("normalizeGermanNumber", () => {
  it("reads the German decimal comma", () => {
    expect(normalizeGermanNumber("1234,56")).toBe("1234.56");
  });

  it("reads comma decimals with dot thousands groupings", () => {
    expect(normalizeGermanNumber("1.234.567,89")).toBe("1234567.89");
  });

  it("treats a lone dot before three digits as a thousands grouping", () => {
    expect(normalizeGermanNumber("1.234")).toBe("1234");
    expect(normalizeGermanNumber("12.345")).toBe("12345");
  });

  it("treats a lone dot before any other digit count as a decimal point", () => {
    expect(normalizeGermanNumber("1.5")).toBe("1.5");
    expect(normalizeGermanNumber("1.2345")).toBe("1.2345");
  });

  it("strips currency symbols and whitespace", () => {
    expect(normalizeGermanNumber(" 1.234,56 € ")).toBe("1234.56");
    expect(normalizeGermanNumber("1234,56 EUR")).toBe("1234.56");
  });

  it("keeps a leading minus", () => {
    expect(normalizeGermanNumber("-1.234,56")).toBe("-1234.56");
  });

  it("rejects input that is not a number", () => {
    expect(normalizeGermanNumber("")).toBeNull();
    expect(normalizeGermanNumber("abc")).toBeNull();
    expect(normalizeGermanNumber("1,2,3")).toBeNull();
    expect(normalizeGermanNumber(".")).toBeNull();
  });
});

describe("parseGermanNumber", () => {
  it("returns a plain number", () => {
    expect(parseGermanNumber("7,5")).toBe(7.5);
    expect(parseGermanNumber("0")).toBe(0);
  });
});

describe("parseMoney", () => {
  it("parses whole euros into cents", () => {
    expect(parseMoney("1000")).toBe(100_000);
  });

  it("parses cents exactly, without float drift", () => {
    expect(parseMoney("0,07")).toBe(7);
    expect(parseMoney("1,005")).toBe(101);
    expect(parseMoney("1234,56")).toBe(123_456);
  });

  it("parses thousands groupings", () => {
    expect(parseMoney("1.234,56")).toBe(123_456);
    expect(parseMoney("250.000")).toBe(25_000_000);
  });

  it("parses negatives", () => {
    expect(parseMoney("-12,34")).toBe(-1234);
  });

  it("rejects rubbish", () => {
    expect(parseMoney("abc")).toBeNull();
  });
});

describe("formatting", () => {
  it("formats euros the German way, with the non-breaking space Intl uses", () => {
    expect(formatEuro(123_456)).toBe("1.234,56\u00a0€");
  });

  it("can re-parse its own formatted output", () => {
    expect(parseMoney(formatEuro(123_456))).toBe(123_456);
  });

  it("formats percentages the German way", () => {
    expect(formatPercent(7)).toBe("7,00 %");
  });

  it("round-trips an editable money string", () => {
    expect(formatMoneyInput(100_000)).toBe("1.000");
    expect(formatMoneyInput(123_456)).toBe("1.234,56");
    expect(parseMoney(formatMoneyInput(123_456))).toBe(123_456);
  });
});

describe("formatNumberInput", () => {
  it("keeps the precision the user entered", () => {
    expect(formatNumberInput(6.125)).toBe("6,125");
    expect(formatNumberInput(6.5)).toBe("6,5");
    expect(formatNumberInput(7)).toBe("7");
    expect(formatNumberInput(0)).toBe("0");
  });

  it("round-trips through the German parser", () => {
    for (const value of [6.125, 6.5, 7, 2, 1.375, 0, 6.12345, 0.0000001, -5]) {
      expect(parseGermanNumber(formatNumberInput(value))).toBe(value);
    }
  });

  it("keeps precision past two places, where the field is re-parsed", () => {
    expect(formatNumberInput(6.12345)).toBe("6,12345");
  });

  it("avoids exponential notation for very small values", () => {
    expect(formatNumberInput(0.0000001)).toBe("0,0000001");
  });

  it("does not surface floating-point artefacts", () => {
    expect(formatNumberInput(0.1 + 0.2)).toBe("0,3");
  });
});
