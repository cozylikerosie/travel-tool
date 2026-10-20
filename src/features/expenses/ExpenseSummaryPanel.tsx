import { formatMoney } from "../../shared/money/budget";
import { getExpenseCategoryLabel, type Expense } from "./expenseSchema";
import { summarizeExpenses, type BudgetStatus, type CurrencyTotal } from "./expenseSummary";
import type { Trip } from "../trips/tripSchema";

const STATUS_TEXT: Record<BudgetStatus, { label: string; className: string }> = {
  good: { label: "預算充足", className: "text-budget-good" },
  near: { label: "接近預算上限", className: "text-budget-near" },
  over: { label: "已超出預算", className: "text-budget-over" },
};

function formatTotals(totals: CurrencyTotal[]): string {
  return totals.map((total) => formatMoney(total.amountMinor, total.currency)).join("＋");
}

interface ExpenseSummaryPanelProps {
  trip: Trip;
  expenses: Expense[];
}

export function ExpenseSummaryPanel({ trip, expenses }: ExpenseSummaryPanelProps) {
  const summary = summarizeExpenses(expenses, { amountMinor: trip.budgetAmountMinor, currency: trip.budgetCurrency });

  if (!summary.count) {
    return (
      <p className="border-t border-rule py-6 text-sm text-muted">
        還沒有花費記錄。旅途中在手機的旅途模式記帳，回來後匯出花費檔，再在這裡匯入。
      </p>
    );
  }

  return (
    <div className="grid gap-8 md:grid-cols-2 md:gap-12">
      <div className="grid content-start gap-2 border-b border-rule pb-6">
        <p className="font-label text-xs uppercase tracking-[0.15em] text-muted">TOTAL</p>
        <p className="font-display text-3xl tabular-nums text-ink" data-testid="expense-total">
          {formatTotals(summary.totals)}
        </p>
        <p className="text-sm text-muted">共 {summary.count} 筆</p>
        {summary.budget && (
          <p className="text-sm tabular-nums">
            <span className={STATUS_TEXT[summary.budget.status].className}>{STATUS_TEXT[summary.budget.status].label}</span>
            <span className="text-muted">
              {" "}・預算 {formatMoney(summary.budget.amountMinor, summary.budget.currency)}，
              {summary.budget.remainingMinor >= 0
                ? `剩餘 ${formatMoney(summary.budget.remainingMinor, summary.budget.currency)}`
                : `超出 ${formatMoney(-summary.budget.remainingMinor, summary.budget.currency)}`}
            </span>
          </p>
        )}
      </div>
      <div className="grid content-start gap-3 border-b border-rule pb-6">
        <p className="font-label text-xs uppercase tracking-[0.15em] text-muted">BY CATEGORY</p>
        <ul aria-label="依類別的花費" className="grid">
          {summary.byCategory.map((entry) => (
            <li className="flex justify-between gap-4 border-t border-rule py-2 text-base" key={entry.category}>
              <span className="text-ink">{getExpenseCategoryLabel(entry.category)}</span>
              <span className="tabular-nums text-ink">{formatTotals(entry.totals)}</span>
            </li>
          ))}
        </ul>
      </div>
      <div className="grid content-start gap-3 border-b border-rule pb-6 md:col-span-2">
        <p className="font-label text-xs uppercase tracking-[0.15em] text-muted">BY DAY</p>
        <ul aria-label="每日花費" className="grid md:grid-cols-2 md:gap-x-12">
          {summary.byDay.map((entry) => (
            <li className="flex justify-between gap-4 border-t border-rule py-2 text-base" key={entry.dayNumber}>
              <span className="font-display text-lg text-ink">Day {entry.dayNumber}</span>
              <span className="tabular-nums text-ink">{formatTotals(entry.totals)}</span>
            </li>
          ))}
        </ul>
      </div>
      <details className="md:col-span-2">
        <summary className="min-h-11 cursor-pointer py-2 text-sm text-ink underline decoration-rule underline-offset-4">
          查看全部 {summary.count} 筆明細
        </summary>
        <ul aria-label="花費明細" className="grid">
          {expenses.map((expense) => (
            <li className="grid grid-cols-[4.5rem_4rem_minmax(0,1fr)_auto] gap-3 border-t border-rule py-2 text-sm" key={expense.id}>
              <span className="text-muted">Day {expense.dayNumber}</span>
              <span className="text-muted">{getExpenseCategoryLabel(expense.category)}</span>
              <span className="truncate text-ink">{expense.note || "—"}</span>
              <span className="tabular-nums text-ink">{formatMoney(expense.amountMinor, expense.currency)}</span>
            </li>
          ))}
        </ul>
      </details>
    </div>
  );
}
