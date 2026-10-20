import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { App } from "../../../src/app/App";
import { createExpenseRepository } from "../../../src/data/expenseRepository";
import { createTransferRepository } from "../../../src/data/transferRepository";
import { TravelModePage } from "../../../src/features/travel/TravelModePage";
import { cleanupDatabases, nineDayTrip, setupItinerary } from "../itinerary/helpers";

afterEach(cleanupDatabases);

const budgetTrip = { ...nineDayTrip, budgetAmountMinor: 100000, budgetCurrency: "JPY" as const };

describe("travel mode", () => {
  it("opens on today's day with a read-only itinerary and records expenses offline", async () => {
    const user = userEvent.setup();
    const setup = await setupItinerary(budgetTrip);
    const first = await setup.addPlace(3, "高松城", "09:00");
    const second = await setup.addPlace(3, "栗林公園", "10:30");
    await setup.setMode(3, first.id, second.id, "bus");
    const expenseRepository = createExpenseRepository(setup.database);

    render(
      <TravelModePage
        expenseRepository={expenseRepository}
        itineraryRepository={setup.itineraryRepository}
        onBack={vi.fn()}
        today="2026-12-12"
        transferRepository={createTransferRepository(setup.database)}
        trip={budgetTrip}
      />,
    );

    const itinerary = await screen.findByRole("list", { name: "當天行程" });
    expect(within(itinerary).getByText("高松城")).toBeInTheDocument();
    expect(within(itinerary).getByText("↓ 巴士")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /新增地點|編輯/ })).not.toBeInTheDocument();

    await user.type(screen.getByLabelText("金額"), "1500");
    await user.click(screen.getByLabelText("門票"));
    await user.type(screen.getByLabelText("備註（選填）"), "栗林公園");
    await user.click(screen.getByRole("button", { name: "記錄到 Day 3" }));

    expect(await screen.findByRole("status")).toHaveTextContent("已記錄 門票");
    expect(within(screen.getByRole("list", { name: "當天花費" })).getByText("栗林公園")).toBeInTheDocument();
    expect(screen.getByTestId("remaining-budget")).toHaveTextContent("98,500");
    expect(await expenseRepository.listForTrip(budgetTrip.id)).toMatchObject([
      { dayNumber: 3, amountMinor: 1500, currency: "JPY", category: "ticket" },
    ]);

    await user.click(screen.getByRole("button", { name: /刪除花費/ }));
    expect(await screen.findByText("這一天還沒有花費記錄。")).toBeInTheDocument();
    expect(await expenseRepository.listForTrip(budgetTrip.id)).toHaveLength(0);
  });

  it("shows an error instead of saving an invalid amount", async () => {
    const user = userEvent.setup();
    const setup = await setupItinerary(budgetTrip);
    render(
      <TravelModePage
        expenseRepository={createExpenseRepository(setup.database)}
        itineraryRepository={setup.itineraryRepository}
        onBack={vi.fn()}
        today="2026-01-01"
        transferRepository={createTransferRepository(setup.database)}
        trip={budgetTrip}
      />,
    );
    await user.click(await screen.findByRole("button", { name: "記錄到 Day 1" }));
    expect(screen.getByRole("alert")).toHaveTextContent("請輸入金額");
  });
});

describe("expense import on the computer", () => {
  it("imports the phone's expense file and shows the full result against the budget", async () => {
    const user = userEvent.setup();
    const computer = await setupItinerary(budgetTrip);
    const phone = await setupItinerary(budgetTrip);
    const phoneExpenses = createExpenseRepository(phone.database);
    await phoneExpenses.add(budgetTrip.id, { dayNumber: 1, amountMinor: 60000, currency: "JPY", category: "lodging", note: "" });
    await phoneExpenses.add(budgetTrip.id, { dayNumber: 2, amountMinor: 25000, currency: "JPY", category: "food", note: "" });
    const fileText = JSON.stringify(await createTransferRepository(phone.database).exportExpenses(budgetTrip.id));

    render(
      <App
        expenseRepository={createExpenseRepository(computer.database)}
        itineraryRepository={computer.itineraryRepository}
        repository={computer.tripRepository}
        transferRepository={createTransferRepository(computer.database)}
      />,
    );
    await user.click(await screen.findByRole("button", { name: new RegExp(budgetTrip.name) }));
    expect(await screen.findByText(/還沒有花費記錄/)).toBeInTheDocument();

    await user.upload(screen.getByLabelText("匯入花費檔"), new File([fileText], "花費.json", { type: "application/json" }));

    expect(await screen.findByRole("status")).toHaveTextContent("已匯入 2 筆新花費");
    expect(screen.getByTestId("expense-total")).toHaveTextContent("85,000");
    expect(screen.getByText("接近預算上限")).toBeInTheDocument();
    expect(within(screen.getByRole("list", { name: "依類別的花費" })).getByText("住宿")).toBeInTheDocument();
    expect(within(screen.getByRole("list", { name: "每日花費" })).getAllByRole("listitem")).toHaveLength(2);
  });
});
