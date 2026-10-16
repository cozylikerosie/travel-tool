import { describe, expect, it } from "vitest";
import {
  CURRENCIES,
  CURRENCY_CODES,
  formatCurrencyLabel,
  getCurrencyMinorDigits,
} from "../../src/shared/money/currencies";

describe("shared currency list", () => {
  it("lists all supported currencies with TWD and JPY first", () => {
    expect(CURRENCY_CODES).toEqual([
      "TWD", "JPY", "KRW", "USD", "EUR", "HKD", "CNY",
      "THB", "VND", "SGD", "MYR", "GBP", "AUD",
    ]);
    expect(new Set(CURRENCY_CODES).size).toBe(CURRENCIES.length);
  });

  it("formats labels as Chinese name with the code in full-width parentheses", () => {
    expect(formatCurrencyLabel("TWD")).toBe("台幣（TWD）");
    expect(formatCurrencyLabel("JPY")).toBe("日圓（JPY）");
    expect(formatCurrencyLabel("MYR")).toBe("馬來西亞令吉（MYR）");
  });

  it("uses zero minor digits for JPY, KRW and VND and two for the others", () => {
    const zeroDigit = ["JPY", "KRW", "VND"];
    for (const code of CURRENCY_CODES) {
      expect(getCurrencyMinorDigits(code)).toBe(zeroDigit.includes(code) ? 0 : 2);
    }
  });
});
