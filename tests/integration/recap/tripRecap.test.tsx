import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { App } from "../../../src/app/App";
import { createExpenseRepository } from "../../../src/data/expenseRepository";
import { createTransferRepository } from "../../../src/data/transferRepository";
import type { Expense } from "../../../src/features/expenses/expenseSchema";
import { buildTripRecap } from "../../../src/features/recap/tripRecap";
import { cleanupDatabases, nineDayTrip, setupItinerary } from "../itinerary/helpers";

afterEach(cleanupDatabases);

const budgetTrip = { ...nineDayTrip, budgetAmountMinor: 100000, budgetCurrency: "JPY" as const };

function expense(overrides: Partial<Expense>): Expense {
  return {
    id: crypto.randomUUID(),
    tripId: budgetTrip.id,
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

describe("trip recap model", () => {
  it("lists every trip day and computes category shares in one currency", () => {
    const recap = buildTripRecap(budgetTrip, [], [
      expense({ amountMinor: 3000, category: "lodging", dayNumber: 2 }),
      expense({ amountMinor: 1000, category: "food", dayNumber: 2 }),
      expense({ amountMinor: 999, currency: "TWD", category: "shopping" }),
    ]);

    expect(recap.days).toHaveLength(9);
    expect(recap.days[1]!.totals).toEqual([{ currency: "JPY", amountMinor: 4000 }]);
    expect(recap.mainCurrency).toBe("JPY");
    expect(recap.categoryShares).toEqual([
      { category: "lodging", amountMinor: 3000, share: 0.75 },
      { category: "food", amountMinor: 1000, share: 0.25 },
    ]);
  });

  it("uses the most frequent currency when there is no budget", () => {
    const recap = buildTripRecap(nineDayTrip, [], [
      expense({ currency: "TWD" }),
      expense({ currency: "TWD" }),
      expense({ currency: "JPY" }),
    ]);
    expect(recap.mainCurrency).toBe("TWD");
  });
});

describe("trip recap page", () => {
  it("shows where each day went and how much was spent, and can be printed", async () => {
    const user = userEvent.setup();
    const setup = await setupItinerary(budgetTrip);
    await setup.addPlace(1, "岡山城", "09:00");
    await setup.addPlace(1, "後樂園", "11:00");
    const expenseRepository = createExpenseRepository(setup.database);
    await expenseRepository.add(budgetTrip.id, { dayNumber: 1, amountMinor: 400, currency: "JPY", category: "ticket", note: "後樂園門票" });
    await expenseRepository.add(budgetTrip.id, { dayNumber: 1, amountMinor: 1600, currency: "JPY", category: "food", note: "" });
    const print = vi.spyOn(window, "print").mockImplementation(() => {});

    render(
      <App
        expenseRepository={expenseRepository}
        itineraryRepository={setup.itineraryRepository}
        repository={setup.tripRepository}
        transferRepository={createTransferRepository(setup.database)}
      />,
    );
    await user.click(await screen.findByRole("button", { name: new RegExp(budgetTrip.name) }));
    await user.click(await screen.findByRole("button", { name: "旅程回顧" }));

    const dayOne = await screen.findByRole("region", { name: "Day 1 回顧" });
    const dayOnePlaces = within(dayOne).getByRole("list", { name: "Day 1 的地點" });
    expect(within(dayOnePlaces).getAllByRole("listitem").map((item) => item.textContent)).toEqual([
      expect.stringContaining("岡山城"),
      expect.stringContaining("後樂園"),
    ]);
    const dayOneExpenses = within(dayOne).getByRole("list", { name: "Day 1 的花費" });
    expect(within(dayOneExpenses).getByText("後樂園門票")).toBeInTheDocument();
    expect(within(dayOneExpenses).getByText("餐飲")).toBeInTheDocument();
    expect(within(dayOne).getByText(/2,000/)).toBeInTheDocument();
    expect(within(screen.getByRole("region", { name: "Day 2 回顧" })).getByText("這一天沒有記錄。")).toBeInTheDocument();
    expect(screen.getByTestId("recap-total")).toHaveTextContent("2,000");
    expect(within(screen.getByRole("list", { name: "花費比例" })).getByText(/80%/)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "列印／存成 PDF" }));
    expect(print).toHaveBeenCalled();
    print.mockRestore();
  });
});
