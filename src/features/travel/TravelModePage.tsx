import { ArrowLeft, Download, Trash2 } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";
import type { ExpenseRepository } from "../../data/expenseRepository";
import type { ItineraryRepository } from "../../data/itineraryRepository";
import { expensesFileName, type TransferRepository } from "../../data/transferRepository";
import { getTodayLocalDate, listTripDays } from "../../shared/dates/tripDates";
import { downloadJson } from "../../shared/files/jsonFile";
import { formatMoney } from "../../shared/money/budget";
import { CURRENCIES, type CurrencyCode } from "../../shared/money/currencies";
import {
  EXPENSE_CATEGORIES,
  expenseFormSchema,
  getExpenseCategoryLabel,
  type Expense,
  type ExpenseCategoryCode,
} from "../expenses/expenseSchema";
import { summarizeExpenses } from "../expenses/expenseSummary";
import { DayTabs } from "../itinerary/DayTabs";
import { deriveDepartureTime, type Place, type TransportSegment } from "../itinerary/itinerarySchema";
import { listAdjacentPairs } from "../itinerary/itineraryOrdering";
import { getTransportMode } from "../itinerary/transportModes";
import type { Trip } from "../trips/tripSchema";

interface TravelModePageProps {
  trip: Trip;
  itineraryRepository: ItineraryRepository;
  expenseRepository: ExpenseRepository;
  transferRepository: TransferRepository;
  today?: string;
  onBack: () => void;
}

const inputClass =
  "min-h-12 w-full border-b border-rule bg-transparent px-0 py-2 text-base text-ink outline-none focus:border-ink";

function initialDayNumber(trip: Trip, today: string): number {
  return listTripDays(trip.startDate, trip.endDate).find((day) => day.date === today)?.dayNumber ?? 1;
}

function stayText(place: Place): string {
  if (place.stay.kind === "departure") return `${place.stay.time} 離開`;
  if (place.stay.kind === "duration") {
    const departure = deriveDepartureTime(place.arrivalTime, place.stay.minutes);
    return `${departure.nextDay ? "隔天 " : ""}${departure.time} 離開`;
  }
  return "";
}

export function TravelModePage({
  trip,
  itineraryRepository,
  expenseRepository,
  transferRepository,
  today = getTodayLocalDate(),
  onBack,
}: TravelModePageProps) {
  const days = listTripDays(trip.startDate, trip.endDate);
  const [dayNumber, setDayNumber] = useState(() => initialDayNumber(trip, today));
  const [places, setPlaces] = useState<Place[]>([]);
  const [segments, setSegments] = useState<TransportSegment[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState<CurrencyCode>(trip.budgetCurrency ?? "TWD");
  const [category, setCategory] = useState<ExpenseCategoryCode>("food");
  const [note, setNote] = useState("");
  const [formError, setFormError] = useState("");
  const [savedMessage, setSavedMessage] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    let isCurrent = true;
    void Promise.all([
      itineraryRepository.listPlacesForDay(trip.id, dayNumber),
      itineraryRepository.listSegmentsForDay(trip.id, dayNumber),
    ]).then(([dayPlaces, daySegments]) => {
      if (!isCurrent) return;
      setPlaces(dayPlaces);
      setSegments(daySegments);
    });
    return () => {
      isCurrent = false;
    };
  }, [itineraryRepository, trip.id, dayNumber]);

  useEffect(() => {
    let isCurrent = true;
    void expenseRepository.listForTrip(trip.id).then((saved) => {
      if (isCurrent) setExpenses(saved);
    });
    return () => {
      isCurrent = false;
    };
  }, [expenseRepository, trip.id]);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    // 避免連點重複記錄同一筆
    if (isSaving) return;
    setSavedMessage("");
    const parsed = expenseFormSchema.safeParse({ dayNumber, amount, currency, category, note });
    if (!parsed.success) {
      setFormError(parsed.error.issues[0]?.message ?? "花費資料不正確");
      return;
    }
    setIsSaving(true);
    try {
      const expense = await expenseRepository.add(trip.id, parsed.data);
      setExpenses(await expenseRepository.listForTrip(trip.id));
      setFormError("");
      setAmount("");
      setNote("");
      setSavedMessage(`已記錄 ${getExpenseCategoryLabel(expense.category)} ${formatMoney(expense.amountMinor, expense.currency)}`);
    } catch {
      setFormError("儲存失敗，請再試一次。");
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDelete(expense: Expense) {
    await expenseRepository.delete(expense.id);
    setExpenses((current) => current.filter((item) => item.id !== expense.id));
  }

  async function handleExport() {
    downloadJson(expensesFileName(trip), await transferRepository.exportExpenses(trip.id));
  }

  const summary = summarizeExpenses(expenses, { amountMinor: trip.budgetAmountMinor, currency: trip.budgetCurrency });
  const dayExpenses = expenses.filter((expense) => expense.dayNumber === dayNumber);
  const daySummary = summarizeExpenses(dayExpenses, { amountMinor: null, currency: null });
  const modeAfter = new Map(segments.map((segment) => [segment.fromPlaceId, segment.mode]));
  const pairs = new Set(listAdjacentPairs(places).map(([from]) => from.id));
  const selectedDay = days.find((day) => day.dayNumber === dayNumber);

  return (
    <main className="mx-auto grid min-h-screen w-full max-w-2xl content-start gap-8 px-4 py-6 text-base">
      <header className="grid gap-4 border-b-2 border-ink pb-5">
        <button
          className="inline-flex min-h-11 w-fit items-center gap-2 text-sm text-muted hover:text-ink"
          onClick={onBack}
          type="button"
        >
          <ArrowLeft aria-hidden="true" className="size-4" />
          返回旅程
        </button>
        <div className="grid gap-1">
          <p className="font-label text-xs uppercase tracking-[0.15em] text-muted">ON THE ROAD／旅途模式</p>
          <h1 className="font-title text-3xl leading-tight text-ink">{trip.name}</h1>
        </div>
        {summary.budget && (
          <p className="tabular-nums text-ink" data-testid="remaining-budget">
            剩餘預算{" "}
            <span className={`font-display text-2xl ${summary.budget.remainingMinor < 0 ? "text-budget-over" : ""}`}>
              {summary.budget.remainingMinor >= 0
                ? formatMoney(summary.budget.remainingMinor, summary.budget.currency)
                : `−${formatMoney(-summary.budget.remainingMinor, summary.budget.currency)}`}
            </span>
          </p>
        )}
      </header>

      <DayTabs days={days} onSelect={setDayNumber} selectedDayNumber={dayNumber} />

      <section aria-labelledby="travel-itinerary-title" className="grid gap-3">
        <h2 className="font-title text-xl text-ink" id="travel-itinerary-title">
          {selectedDay?.label ?? `Day ${dayNumber}`} 行程
        </h2>
        {places.length ? (
          <ol aria-label="當天行程" className="grid">
            {places.map((place, index) => (
              <li className="grid gap-1 border-t border-rule py-4" key={place.id}>
                <div className="grid grid-cols-[3.5rem_minmax(0,1fr)] gap-3">
                  <span className="font-label text-base tabular-nums text-muted">{place.arrivalTime}</span>
                  <div className="grid gap-1">
                    <p className="font-title text-lg text-ink">
                      <span className="mr-2 font-display text-accent">{index + 1}</span>
                      {place.name || "未命名地點"}
                    </p>
                    {place.address && <p className="text-muted">{place.address}</p>}
                    {stayText(place) && <p className="text-muted">{stayText(place)}</p>}
                    {place.notes && <p className="whitespace-pre-wrap text-ink">{place.notes}</p>}
                  </div>
                </div>
                {pairs.has(place.id) && (
                  <p className="pl-[4.25rem] text-sm text-muted">↓ {getTransportMode(modeAfter.get(place.id) ?? null).label}</p>
                )}
              </li>
            ))}
          </ol>
        ) : (
          <p className="border-t border-rule py-4 text-muted">這一天沒有安排地點。</p>
        )}
      </section>

      <section aria-labelledby="expense-form-title" className="grid gap-4 border-t-2 border-ink pt-5">
        <h2 className="font-title text-xl text-ink" id="expense-form-title">記一筆花費</h2>
        <form className="grid gap-4" noValidate onSubmit={handleSubmit}>
          <div className="grid grid-cols-[minmax(0,1fr)_8rem] gap-3">
            <label className="grid gap-1">
              <span className="text-sm text-muted">金額</span>
              <input
                className={`${inputClass} font-display text-2xl tabular-nums`}
                inputMode="decimal"
                onChange={(event) => setAmount(event.target.value)}
                value={amount}
              />
            </label>
            <label className="grid gap-1">
              <span className="text-sm text-muted">幣別</span>
              <select
                className={inputClass}
                onChange={(event) => setCurrency(event.target.value as CurrencyCode)}
                value={currency}
              >
                {CURRENCIES.map((option) => (
                  <option key={option.code} value={option.code}>
                    {option.code} {option.name}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <fieldset className="grid gap-2">
            <legend className="mb-2 text-sm text-muted">類別</legend>
            <div className="grid grid-cols-3 gap-2">
              {EXPENSE_CATEGORIES.map((option) => (
                <label
                  className={`grid min-h-11 cursor-pointer place-items-center border text-base ${
                    category === option.code ? "border-ink bg-ink text-paper" : "border-rule text-ink"
                  }`}
                  key={option.code}
                >
                  <input
                    checked={category === option.code}
                    className="sr-only"
                    name="expense-category"
                    onChange={() => setCategory(option.code)}
                    type="radio"
                    value={option.code}
                  />
                  {option.label}
                </label>
              ))}
            </div>
          </fieldset>
          <label className="grid gap-1">
            <span className="text-sm text-muted">備註（選填）</span>
            <input className={inputClass} onChange={(event) => setNote(event.target.value)} value={note} />
          </label>
          {formError && <p className="text-sm text-budget-over" role="alert">{formError}</p>}
          {savedMessage && <p className="text-sm text-ink" role="status">{savedMessage}</p>}
          <button className="min-h-12 border border-ink bg-ink text-base text-paper disabled:opacity-60" disabled={isSaving} type="submit">
            記錄到 Day {dayNumber}
          </button>
        </form>
      </section>

      <section aria-labelledby="day-expenses-title" className="grid gap-3">
        <div className="flex items-baseline justify-between gap-4">
          <h2 className="font-title text-xl text-ink" id="day-expenses-title">Day {dayNumber} 花費</h2>
          {daySummary.totals.length > 0 && (
            <p className="tabular-nums text-ink" data-testid="day-expense-total">
              {daySummary.totals.map((total) => formatMoney(total.amountMinor, total.currency)).join("＋")}
            </p>
          )}
        </div>
        {dayExpenses.length ? (
          <ul aria-label="當天花費" className="grid">
            {dayExpenses.map((expense) => (
              <li className="grid grid-cols-[3.5rem_minmax(0,1fr)_auto_2.75rem] items-center gap-2 border-t border-rule py-2" key={expense.id}>
                <span className="text-sm text-muted">{getExpenseCategoryLabel(expense.category)}</span>
                <span className="truncate text-ink">{expense.note || "—"}</span>
                <span className="tabular-nums text-ink">{formatMoney(expense.amountMinor, expense.currency)}</span>
                <button
                  aria-label={`刪除花費：${getExpenseCategoryLabel(expense.category)} ${formatMoney(expense.amountMinor, expense.currency)}`}
                  className="grid size-11 place-items-center text-muted hover:text-budget-over"
                  onClick={() => void handleDelete(expense)}
                  type="button"
                >
                  <Trash2 aria-hidden="true" className="size-4" />
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="border-t border-rule py-4 text-muted">這一天還沒有花費記錄。</p>
        )}
      </section>

      <section className="grid gap-2 border-t-2 border-ink pt-5">
        <p className="text-sm text-muted">旅程結束後，匯出花費檔傳到電腦，在電腦的旅程頁匯入即可查看完整花費。</p>
        <button
          className="inline-flex min-h-12 items-center justify-center gap-2 border border-ink text-base text-ink"
          disabled={!expenses.length}
          onClick={() => void handleExport()}
          type="button"
        >
          <Download aria-hidden="true" className="size-4" />
          匯出花費檔（{expenses.length} 筆）
        </button>
      </section>
    </main>
  );
}
