import { ArrowLeft, Printer } from "lucide-react";
import { useEffect, useState } from "react";
import type { ExpenseRepository } from "../../data/expenseRepository";
import type { ItineraryRepository } from "../../data/itineraryRepository";
import { formatTripDayDate, getTripDurationDays, getWeekdayShort } from "../../shared/dates/tripDates";
import { formatMoney } from "../../shared/money/budget";
import type { CurrencyTotal } from "../expenses/expenseSummary";
import { getExpenseCategoryLabel } from "../expenses/expenseSchema";
import type { Trip } from "../trips/tripSchema";
import { buildTripRecap, type RecapDay, type TripRecap } from "./tripRecap";

interface TripRecapPageProps {
  trip: Trip;
  itineraryRepository: ItineraryRepository;
  expenseRepository: ExpenseRepository;
  onBack: () => void;
}

function formatTotals(totals: CurrencyTotal[]): string {
  return totals.map((total) => formatMoney(total.amountMinor, total.currency)).join("＋");
}

function RecapDaySection({ entry }: { entry: RecapDay }) {
  const { day, places, expenses, totals } = entry;
  const isEmpty = !places.length && !expenses.length;

  return (
    <section
      aria-label={`Day ${day.dayNumber} 回顧`}
      className="print-keep grid gap-5 border-t-2 border-ink pt-5 md:grid-cols-[11rem_minmax(0,1fr)_minmax(0,1fr)] md:gap-10"
    >
      <header className="flex items-baseline gap-4 md:grid md:content-start md:gap-1">
        <p className="font-display text-4xl leading-none text-ink">Day {day.dayNumber}</p>
        <p className="font-label text-xs uppercase tracking-[0.15em] text-muted">
          {formatTripDayDate(day.date)} {getWeekdayShort(day.date)}
        </p>
        {totals.length > 0 && (
          <p className="ml-auto font-display text-xl tabular-nums text-accent md:ml-0 md:pt-3">{formatTotals(totals)}</p>
        )}
      </header>

      {isEmpty ? (
        <p className="text-muted md:col-span-2">這一天沒有記錄。</p>
      ) : (
        <>
          <div className="grid content-start gap-2">
            <p className="font-label text-[11px] uppercase tracking-[0.15em] text-muted">WHERE／去了哪裡</p>
            {places.length ? (
              <ol aria-label={`Day ${day.dayNumber} 的地點`} className="grid">
                {places.map((place, index) => (
                  <li className="grid grid-cols-[2rem_3.25rem_minmax(0,1fr)] items-baseline gap-2 border-t border-rule py-2" key={place.id}>
                    <span className="font-display text-lg text-accent">{index + 1}</span>
                    <span className="font-label text-sm tabular-nums text-muted">{place.arrivalTime}</span>
                    <span className="font-title text-base text-ink">{place.name || "未命名地點"}</span>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="border-t border-rule py-2 text-sm text-muted">沒有安排地點</p>
            )}
          </div>
          <div className="grid content-start gap-2">
            <p className="font-label text-[11px] uppercase tracking-[0.15em] text-muted">SPENT／花了多少</p>
            {expenses.length ? (
              <ul aria-label={`Day ${day.dayNumber} 的花費`} className="grid">
                {expenses.map((expense) => (
                  <li className="grid grid-cols-[3rem_minmax(0,1fr)_auto] items-baseline gap-2 border-t border-rule py-2 text-sm" key={expense.id}>
                    <span className="text-muted">{getExpenseCategoryLabel(expense.category)}</span>
                    <span className="truncate text-ink">{expense.note}</span>
                    <span className="tabular-nums text-ink">{formatMoney(expense.amountMinor, expense.currency)}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="border-t border-rule py-2 text-sm text-muted">沒有花費記錄</p>
            )}
          </div>
        </>
      )}
    </section>
  );
}

export function TripRecapPage({ trip, itineraryRepository, expenseRepository, onBack }: TripRecapPageProps) {
  const [recap, setRecap] = useState<TripRecap | null>(null);

  useEffect(() => {
    let isCurrent = true;
    void Promise.all([itineraryRepository.listPlacesForTrip(trip.id), expenseRepository.listForTrip(trip.id)]).then(
      ([places, expenses]) => {
        if (isCurrent) setRecap(buildTripRecap(trip, places, expenses));
      },
    );
    return () => {
      isCurrent = false;
    };
  }, [itineraryRepository, expenseRepository, trip]);

  const dayCount = getTripDurationDays(trip.startDate, trip.endDate);
  const budget = recap?.summary.budget;

  return (
    <main className="mx-auto grid min-h-screen w-full max-w-6xl content-start gap-10 px-5 py-8 md:gap-14 md:px-12 md:py-12 print:max-w-none print:p-0">
      <nav className="print-hidden flex flex-wrap items-center justify-between gap-4">
        <button
          className="inline-flex min-h-11 w-fit items-center gap-2 text-sm text-muted hover:text-ink"
          onClick={onBack}
          type="button"
        >
          <ArrowLeft aria-hidden="true" className="size-4" />
          返回旅程
        </button>
        <button
          className="inline-flex min-h-11 items-center gap-2 border border-ink px-4 text-sm text-ink hover:bg-ink hover:text-paper"
          onClick={() => window.print()}
          type="button"
        >
          <Printer aria-hidden="true" className="size-4" />
          列印／存成 PDF
        </button>
      </nav>

      <header className="print-keep grid gap-6 border-b-2 border-ink pb-8">
        <p className="font-label text-xs uppercase tracking-[0.15em] text-muted">TRAVEL RECAP／旅程回顧</p>
        <h1 className="font-title text-5xl leading-tight text-ink md:text-7xl">{trip.name}</h1>
        <p className="font-display text-3xl text-ink md:text-4xl">
          {formatTripDayDate(trip.startDate)} — {formatTripDayDate(trip.endDate)}
          <span className="ml-3 font-label text-xs uppercase tracking-[0.15em] text-muted">
            {trip.startDate.slice(0, 4)}・{dayCount} DAYS
          </span>
        </p>
        <p className="text-muted">
          {trip.destinations.join("・")}
          {trip.companions.length > 0 && `　與 ${trip.companions.join("、")} 同行`}
        </p>
      </header>

      {recap && (
        <section aria-label="旅程總覽" className="print-keep grid gap-8 md:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)] md:gap-14">
          <dl className="grid grid-cols-3 gap-4 md:grid-cols-1 md:gap-6">
            <div className="grid gap-1">
              <dt className="font-label text-[11px] uppercase tracking-[0.15em] text-muted">PLACES</dt>
              <dd className="font-display text-4xl text-ink">{recap.placeCount}<span className="ml-1 font-body text-sm text-muted">個地點</span></dd>
            </div>
            <div className="grid gap-1">
              <dt className="font-label text-[11px] uppercase tracking-[0.15em] text-muted">SPENT</dt>
              <dd className="font-display text-3xl tabular-nums text-ink md:text-4xl" data-testid="recap-total">
                {recap.summary.totals.length ? formatTotals(recap.summary.totals) : "—"}
              </dd>
            </div>
            <div className="grid gap-1">
              <dt className="font-label text-[11px] uppercase tracking-[0.15em] text-muted">BUDGET</dt>
              <dd className="text-sm text-ink">
                {budget ? (
                  <>
                    <span className="font-display text-2xl tabular-nums">{formatMoney(budget.amountMinor, budget.currency)}</span>
                    <br />
                    <span className={budget.remainingMinor >= 0 ? "text-budget-good" : "text-budget-over"}>
                      {budget.remainingMinor >= 0
                        ? `剩 ${formatMoney(budget.remainingMinor, budget.currency)}`
                        : `超出 ${formatMoney(-budget.remainingMinor, budget.currency)}`}
                    </span>
                  </>
                ) : (
                  <span className="text-muted">未設定</span>
                )}
              </dd>
            </div>
          </dl>

          <div className="grid content-start gap-3">
            <p className="font-label text-[11px] uppercase tracking-[0.15em] text-muted">
              WHERE THE MONEY WENT{recap.mainCurrency && `（${recap.mainCurrency}）`}
            </p>
            {recap.categoryShares.length ? (
              <ul aria-label="花費比例" className="grid gap-3">
                {recap.categoryShares.map((entry) => (
                  <li className="grid gap-1" key={entry.category}>
                    <div className="flex items-baseline justify-between gap-4 text-sm">
                      <span className="text-ink">{getExpenseCategoryLabel(entry.category)}</span>
                      <span className="tabular-nums text-muted">
                        {formatMoney(entry.amountMinor, recap.mainCurrency!)}・{Math.round(entry.share * 100)}%
                      </span>
                    </div>
                    <div className="h-2 bg-rule">
                      <div
                        className="h-full bg-ink print:[print-color-adjust:exact]"
                        style={{ width: `${Math.max(entry.share * 100, 1)}%` }}
                      />
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted">還沒有花費記錄。匯入手機的花費檔後，這裡會顯示花費比例。</p>
            )}
          </div>
        </section>
      )}

      {recap && (
        <div className="grid gap-10">
          {recap.days.map((entry) => (
            <RecapDaySection entry={entry} key={entry.day.dayNumber} />
          ))}
        </div>
      )}

      {trip.notes && (
        <footer className="print-keep grid gap-2 border-t border-rule pt-6">
          <p className="font-label text-[11px] uppercase tracking-[0.15em] text-muted">NOTES</p>
          <p className="whitespace-pre-wrap text-ink">{trip.notes}</p>
        </footer>
      )}
    </main>
  );
}
