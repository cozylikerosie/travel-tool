import type { CurrencyCode } from "../../shared/money/currencies";
import { EXPENSE_CATEGORIES, type Expense, type ExpenseCategoryCode } from "./expenseSchema";

export type BudgetStatus = "good" | "near" | "over";

export interface CurrencyTotal {
  currency: CurrencyCode;
  amountMinor: number;
}

export interface ExpenseSummary {
  count: number;
  // 不做匯率換算，各幣別分開加總
  totals: CurrencyTotal[];
  byCategory: { category: ExpenseCategoryCode; totals: CurrencyTotal[] }[];
  byDay: { dayNumber: number; totals: CurrencyTotal[] }[];
  budget: {
    amountMinor: number;
    currency: CurrencyCode;
    spentMinor: number;
    remainingMinor: number;
    status: BudgetStatus;
  } | null;
}

// 已用到預算 80% 以上視為接近上限
const NEAR_BUDGET_RATIO = 0.8;

function sumByCurrency(expenses: Expense[]): CurrencyTotal[] {
  const totals = new Map<CurrencyCode, number>();
  for (const expense of expenses) {
    totals.set(expense.currency, (totals.get(expense.currency) ?? 0) + expense.amountMinor);
  }
  return [...totals].map(([currency, amountMinor]) => ({ currency, amountMinor }));
}

export function getBudgetStatus(spentMinor: number, budgetMinor: number): BudgetStatus {
  if (spentMinor > budgetMinor) return "over";
  if (spentMinor >= budgetMinor * NEAR_BUDGET_RATIO) return "near";
  return "good";
}

export function summarizeExpenses(
  expenses: Expense[],
  budget: { amountMinor: number | null; currency: CurrencyCode | null },
): ExpenseSummary {
  const byCategory = EXPENSE_CATEGORIES.map(({ code }) => ({
    category: code,
    totals: sumByCurrency(expenses.filter((expense) => expense.category === code)),
  })).filter((entry) => entry.totals.length);

  const dayNumbers = [...new Set(expenses.map((expense) => expense.dayNumber))].sort((left, right) => left - right);
  const byDay = dayNumbers.map((dayNumber) => ({
    dayNumber,
    totals: sumByCurrency(expenses.filter((expense) => expense.dayNumber === dayNumber)),
  }));

  let budgetSummary: ExpenseSummary["budget"] = null;
  if (budget.amountMinor !== null && budget.currency !== null) {
    const spentMinor = expenses
      .filter((expense) => expense.currency === budget.currency)
      .reduce((total, expense) => total + expense.amountMinor, 0);
    budgetSummary = {
      amountMinor: budget.amountMinor,
      currency: budget.currency,
      spentMinor,
      remainingMinor: budget.amountMinor - spentMinor,
      status: getBudgetStatus(spentMinor, budget.amountMinor),
    };
  }

  return { count: expenses.length, totals: sumByCurrency(expenses), byCategory, byDay, budget: budgetSummary };
}

// 依旅程日、再依記錄時間排序
export function sortExpenses(expenses: Expense[]): Expense[] {
  return [...expenses].sort(
    (left, right) => left.dayNumber - right.dayNumber || left.createdAt.localeCompare(right.createdAt),
  );
}
