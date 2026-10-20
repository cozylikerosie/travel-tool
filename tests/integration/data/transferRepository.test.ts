import { IDBFactory } from "fake-indexeddb";
import { afterEach, describe, expect, it } from "vitest";
import { createTripDatabase, type TripDatabase } from "../../../src/data/database";
import { createExpenseRepository } from "../../../src/data/expenseRepository";
import { createItineraryRepository } from "../../../src/data/itineraryRepository";
import { createTransferRepository } from "../../../src/data/transferRepository";
import { createTripRepository } from "../../../src/data/tripRepository";
import { nineDayTrip } from "../itinerary/helpers";

const databases: TripDatabase[] = [];

afterEach(async () => {
  const active = databases.splice(0);
  for (const database of active) database.close();
  await Promise.all(active.map((database) => database.delete()));
});

// 電腦與手機各自是一個獨立的資料庫
function device(name: string) {
  const database = createTripDatabase(`${name}-${crypto.randomUUID()}`, new IDBFactory());
  databases.push(database);
  return {
    database,
    trips: createTripRepository(database),
    itinerary: createItineraryRepository(database),
    expenses: createExpenseRepository(database),
    transfer: createTransferRepository(database),
  };
}

const placeFields = { address: "", coordinates: null, stay: { kind: "none" }, notes: "" } as const;

describe("computer ↔ phone transfer", () => {
  it("moves the itinerary to the phone and the expenses back without any server", async () => {
    const computer = device("computer");
    const phone = device("phone");
    await computer.trips.create(nineDayTrip);
    const first = await computer.itinerary.addPlace(nineDayTrip.id, 1, { ...placeFields, name: "岡山城", arrivalTime: "09:00" });
    const second = await computer.itinerary.addPlace(nineDayTrip.id, 1, { ...placeFields, name: "後樂園", arrivalTime: "11:00" });
    await computer.itinerary.setTransportMode(nineDayTrip.id, 1, first.id, second.id, "walk");

    const itineraryText = JSON.stringify(await computer.transfer.exportItinerary(nineDayTrip.id));
    await expect(phone.transfer.importItinerary(itineraryText)).resolves.toMatchObject({ replaced: false });
    expect((await phone.itinerary.listPlacesForDay(nineDayTrip.id, 1)).map((place) => place.name)).toEqual(["岡山城", "後樂園"]);
    expect((await phone.itinerary.listSegmentsForDay(nineDayTrip.id, 1))[0]?.mode).toBe("walk");

    await phone.expenses.add(nineDayTrip.id, { dayNumber: 1, amountMinor: 400, currency: "JPY", category: "ticket", note: "門票" });
    await phone.expenses.add(nineDayTrip.id, { dayNumber: 2, amountMinor: 1200, currency: "JPY", category: "food", note: "" });

    const expensesText = JSON.stringify(await phone.transfer.exportExpenses(nineDayTrip.id));
    await expect(computer.transfer.importExpenses(nineDayTrip.id, expensesText)).resolves.toEqual({ added: 2, updated: 0 });
    // 重複匯入同一份檔案不會重複計算
    await expect(computer.transfer.importExpenses(nineDayTrip.id, expensesText)).resolves.toEqual({ added: 0, updated: 2 });
    expect((await computer.expenses.listForTrip(nineDayTrip.id)).map((expense) => expense.amountMinor)).toEqual([400, 1200]);
  });

  it("replaces the phone itinerary on re-import but keeps recorded expenses", async () => {
    const computer = device("computer");
    const phone = device("phone");
    await computer.trips.create(nineDayTrip);
    const old = await computer.itinerary.addPlace(nineDayTrip.id, 1, { ...placeFields, name: "舊地點", arrivalTime: "09:00" });
    await phone.transfer.importItinerary(JSON.stringify(await computer.transfer.exportItinerary(nineDayTrip.id)));
    await phone.expenses.add(nineDayTrip.id, { dayNumber: 1, amountMinor: 500, currency: "JPY", category: "food", note: "" });

    await computer.itinerary.deletePlace(old.id);
    await computer.itinerary.addPlace(nineDayTrip.id, 1, { ...placeFields, name: "新地點", arrivalTime: "10:00" });
    await expect(
      phone.transfer.importItinerary(JSON.stringify(await computer.transfer.exportItinerary(nineDayTrip.id))),
    ).resolves.toMatchObject({ replaced: true });

    expect((await phone.itinerary.listPlacesForDay(nineDayTrip.id, 1)).map((place) => place.name)).toEqual(["新地點"]);
    expect(await phone.expenses.listForTrip(nineDayTrip.id)).toHaveLength(1);
  });

  it("rejects files that are not valid, of the wrong kind, or for another trip", async () => {
    const computer = device("computer");
    await computer.trips.create(nineDayTrip);
    const itineraryText = JSON.stringify(await computer.transfer.exportItinerary(nineDayTrip.id));

    await expect(computer.transfer.importItinerary("not json")).rejects.toThrow("檔案不是有效的 JSON 格式");
    await expect(computer.transfer.importExpenses(nineDayTrip.id, itineraryText)).rejects.toThrow("這不是花費檔");
    await expect(
      computer.transfer.importItinerary(JSON.stringify({ kind: "travel-tool/itinerary", version: 1 })),
    ).rejects.toThrow("檔案內容不完整或已損毀");

    const otherTripFile = { ...(await computer.transfer.exportExpenses(nineDayTrip.id)), tripId: crypto.randomUUID(), tripName: "別的旅程" };
    await expect(computer.transfer.importExpenses(nineDayTrip.id, JSON.stringify(otherTripFile))).rejects.toThrow(
      "這份花費檔屬於「別的旅程」",
    );
  });

  it("deletes a trip's expenses together with the trip", async () => {
    const computer = device("computer");
    await computer.trips.create(nineDayTrip);
    await computer.expenses.add(nineDayTrip.id, { dayNumber: 1, amountMinor: 500, currency: "JPY", category: "food", note: "" });
    await computer.trips.delete(nineDayTrip.id);
    await expect(computer.database.expenses.count()).resolves.toBe(0);
  });
});
