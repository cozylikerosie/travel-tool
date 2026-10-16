import { describe, expect, it } from "vitest";
import {
  formatMoney,
  formatMoneyInput,
  parseMoneyToMinorUnits,
} from "../../src/shared/money/budget";

describe("currency minor-unit money rules", () => {
  it("parses TWD decimal input into integer minor units", () => {
    expect(parseMoneyToMinorUnits("60000", "TWD")).toBe(6_000_000);
    expect(parseMoneyToMinorUnits("60000.25", "TWD")).toBe(6_000_025);
    expect(parseMoneyToMinorUnits("0.01", "TWD")).toBe(1);
  });

  it.each(["KRW", "VND"] as const)("parses %s as a zero-decimal currency", (currency) => {
    expect(parseMoneyToMinorUnits("1500000", currency)).toBe(1_500_000);
    expect(() => parseMoneyToMinorUnits("1500000.5", currency)).toThrow();
    expect(formatMoneyInput(1_500_000, currency)).toBe("1500000");
  });

  it.each(["USD", "EUR", "GBP"] as const)("parses %s with two decimal places", (currency) => {
    expect(parseMoneyToMinorUnits("1234.56", currency)).toBe(123_456);
    expect(parseMoneyToMinorUnits("1234.5", currency)).toBe(123_450);
    expect(() => parseMoneyToMinorUnits("1234.567", currency)).toThrow();
    expect(formatMoneyInput(123_456, currency)).toBe("1234.56");
    expect(formatMoney(123_456, currency)).toContain("1,234.56");
  });

  it("parses JPY as a zero-decimal currency", () => {
    expect(parseMoneyToMinorUnits("250000", "JPY")).toBe(250_000);
    expect(() => parseMoneyToMinorUnits("250000.1", "JPY")).toThrow();
  });

  it.each(["0", "-1", "1e3", "1,000", "1.001", "", "  "]) (
    "rejects invalid TWD input %j",
    (value) => {
      expect(() => parseMoneyToMinorUnits(value, "TWD")).toThrow();
    },
  );

  it("rejects values outside JavaScript's safe integer range", () => {
    expect(() => parseMoneyToMinorUnits("90071992547410", "TWD")).toThrow();
  });

  it("formats integer minor units as the selected currency", () => {
    expect(formatMoney(6_000_000, "TWD")).toContain("60,000.00");
    expect(formatMoney(250_000, "JPY")).toContain("250,000");
  });

  it("formats minor units back to a decimal form value without floating-point math", () => {
    expect(formatMoneyInput(6_000_025, "TWD")).toBe("60000.25");
    expect(formatMoneyInput(250_000, "JPY")).toBe("250000");
  });
});