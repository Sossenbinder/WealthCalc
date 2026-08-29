import { describe, expect, it } from "vitest";
import { applyRate, euros, roundHalfAwayFromZero, toEuros } from "@/lib/engine/money";

describe("roundHalfAwayFromZero", () => {
  it("rounds halves away from zero in both directions", () => {
    expect(roundHalfAwayFromZero(2.5)).toBe(3);
    expect(roundHalfAwayFromZero(-2.5)).toBe(-3);
    expect(roundHalfAwayFromZero(2.4)).toBe(2);
    expect(roundHalfAwayFromZero(-2.4)).toBe(-2);
  });
});

describe("euros", () => {
  it("converts to integer cents", () => {
    expect(euros(1234.56)).toBe(123_456);
    expect(toEuros(123_456)).toBe(1234.56);
  });
});

describe("applyRate", () => {
  it("rounds the product to whole cents", () => {
    expect(applyRate(100_000, 0.07)).toBe(7_000);
    expect(applyRate(1, 0.5)).toBe(1);
  });
});
