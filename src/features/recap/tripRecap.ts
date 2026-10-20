import { listTripDays, type TripDay } from "../../shared/dates/tripDates";
import type { CurrencyCode } from "../../shared/money/currencies";
import type { Expense, ExpenseCategoryCode } from "../expenses/expenseSchema";
import { sortExpenses, summarizeExpenses, type CurrencyTotal, type ExpenseSummary } from "../expenses/expenseSummary";
import { sortPlaces } from "../itinerary/itineraryOrdering";
import type { Place } from "../itinerary/itinerarySchema";
import type { Trip } from "../trips/tripSchema";

export interface RecapDay {
  day: TripDay;
  places: Place[];
  expenses: Expense[];
  totals: CurrencyTotal[];
}

export interface CategoryShare {
  category: ExpenseCategoryCode;
  amountMinor: number;
  // 0～1，占主要幣別總花費的比例
  share: number;
}

export interface TripRecap {
  days: RecapDay[];
  summary: ExpenseSummary;
  placeCount: number;
  // 類別比例只以一種幣別計算，避免不同幣別直接相加
  mainCurrency: CurrencyCode | null;
  categoryShares: CategoryShare[];
}

// 有預算且有該幣別花費時以預算幣別為主，否則取筆數最多的幣別
function pickMainCurrency(expenses: Expense[], budgetCurrency: CurrencyCode | null): CurrencyCode | null {
  if (budgetCurrency && expenses.some((expense) => expense.currency === budgetCurrency)) return budgetCurrency;
  const counts = new Map<CurrencyCode, number>();
  for (const expense of expenses) counts.set(expense.currency, (counts.get(expense.currency) ?? 0) + 1);
  return [...counts].sort((left, right) => right[1] - left[1])[0]?.[0] ?? null;
}

export function buildTripRecap(trip: Trip, places: Place[], expenses: Expense[]): TripRecap {
  const sortedExpenses = sortExpenses(expenses);
  const days = listTripDays(trip.startDate, trip.endDate).map((day) => {
    const dayExpenses = sortedExpenses.filter((expense) => expense.dayNumber === day.dayNumber);
    return {
      day,
      places: sortPlaces(places.filter((place) => place.dayNumber === day.dayNumber)),
      expenses: dayExpenses,
      totals: summarizeExpenses(dayExpenses, { amountMinor: null, currency: null }).totals,
    };
  });

  const summary = summarizeExpenses(sortedExpenses, { amountMinor: trip.budgetAmountMinor, currency: trip.budgetCurrency });
  const mainCurrency = pickMainCurrency(sortedExpenses, trip.budgetCurrency);
  const mainTotal = summary.totals.find((total) => total.currency === mainCurrency)?.amountMinor ?? 0;
  const categoryShares = summary.byCategory
    .map((entry) => {
      const amountMinor = entry.totals.find((total) => total.currency === mainCurrency)?.amountMinor ?? 0;
      return { category: entry.category, amountMinor, share: mainTotal ? amountMinor / mainTotal : 0 };
    })
    .filter((entry) => entry.amountMinor > 0)
    .sort((left, right) => right.amountMinor - left.amountMinor);

  return { days, summary, placeCount: places.length, mainCurrency, categoryShares };
}
