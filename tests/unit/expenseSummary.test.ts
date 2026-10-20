import { describe, expect, it } from "vitest";
import { expenseFormSchema, type Expense } from "../../src/features/expenses/expenseSchema";
import { getBudgetStatus, summarizeExpenses } from "../../src/features/expenses/expenseSummary";

const TRIP_ID = "3d8dfb88-6a9f-4ef6-8cc5-7084fa8cab2f";

function expense(overrides: Partial<Expense>): Expense {
  return {
    id: crypto.randomUUID(),
    tripId: TRIP_ID,
    dayNumber: 1,
    amountMinor: 1000,
    currency: "JPY",
    category: "food",
    note: "",
    createdAt: "2026-12-10T01:00:00.000Z",
    updatedAt: "2026-12-10T01:00:00.000Z",
    ...overrides,
  };
}

describe("expense form", () => {
  it("converts the amount to minor units of the chosen currency", () => {
    const result = expenseFormSchema.safeParse({ dayNumber: 2, amount: "120.5", currency: "TWD", category: "transport", note: " 捷運 " });
    expect(result.success && result.data).toEqual({
      dayNumber: 2,
      amountMinor: 12050,
      currency: "TWD",
      category: "transport",
      note: "捷運",
    });
  });

  it("rejects empty, zero and too-precise amounts", () => {
    const base = { dayNumber: 1, currency: "JPY", category: "food", note: "" } as const;
    expect(expenseFormSchema.safeParse({ ...base, amount: "" }).error?.issues[0]?.message).toBe("請輸入金額");
    expect(expenseFormSchema.safeParse({ ...base, amount: "0" }).success).toBe(false);
    expect(expenseFormSchema.safeParse({ ...base, amount: "10.5" }).success).toBe(false);
  });
});

describe("expense summary", () => {
  it("totals each currency separately, by category and by day", () => {
    const summary = summarizeExpenses(
      [
        expense({ amountMinor: 1200, category: "food", dayNumber: 1 }),
        expense({ amountMinor: 800, category: "food", dayNumber: 2 }),
        expense({ amountMinor: 3000, category: "ticket", dayNumber: 2 }),
        expense({ amountMinor: 50000, currency: "TWD", category: "shopping", dayNumber: 2 }),
      ],
      { amountMinor: null, currency: null },
    );

    expect(summary.count).toBe(4);
    expect(summary.totals).toEqual([
      { currency: "JPY", amountMinor: 5000 },
      { currency: "TWD", amountMinor: 50000 },
    ]);
    expect(summary.byCategory.map((entry) => entry.category)).toEqual(["food", "ticket", "shopping"]);
    expect(summary.byCategory[0]!.totals).toEqual([{ currency: "JPY", amountMinor: 2000 }]);
    expect(summary.byDay.map((entry) => entry.dayNumber)).toEqual([1, 2]);
    expect(summary.budget).toBeNull();
  });

  it("compares only expenses in the budget currency against the budget", () => {
    const summary = summarizeExpenses(
      [expense({ amountMinor: 90000 }), expense({ amountMinor: 999, currency: "TWD" })],
      { amountMinor: 100000, currency: "JPY" },
    );
    expect(summary.budget).toEqual({
      amountMinor: 100000,
      currency: "JPY",
      spentMinor: 90000,
      remainingMinor: 10000,
      status: "near",
    });
  });

  it("classifies budget status at 80% and over 100%", () => {
    expect(getBudgetStatus(79, 100)).toBe("good");
    expect(getBudgetStatus(80, 100)).toBe("near");
    expect(getBudgetStatus(100, 100)).toBe("near");
    expect(getBudgetStatus(101, 100)).toBe("over");
  });
});
