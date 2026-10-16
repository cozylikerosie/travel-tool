import Dexie from "dexie";
import { IDBFactory } from "fake-indexeddb";
import { describe, expect, it } from "vitest";
import { createTripDatabase } from "../../../src/data/database";
import type { Trip } from "../../../src/features/trips/tripSchema";
import type { Place } from "../../../src/features/itinerary/itinerarySchema";

const trip: Trip = {
  id: "3d8dfb88-6a9f-4ef6-8cc5-7084fa8cab2f",
  createdAt: "2026-10-16T01:02:03.000Z",
  updatedAt: "2026-10-16T01:02:03.000Z",
  name: "四國之旅",
  destinations: ["岡山", "香川"],
  startDate: "2026-12-10",
  endDate: "2026-12-18",
  budgetAmountMinor: 6_000_000,
  budgetCurrency: "TWD",
  companions: ["小明"],
  notes: "001 時期建立",
};

describe("database version 1 → 2 upgrade", () => {
  it("keeps existing trips and adds empty, writable itinerary tables", async () => {
    const factory = new IDBFactory();
    const name = `upgrade-${crypto.randomUUID()}`;

    const legacyDatabase = new Dexie(name, { indexedDB: factory });
    legacyDatabase.version(1).stores({ trips: "id,startDate,endDate" });
    await legacyDatabase.table("trips").add(trip);
    legacyDatabase.close();

    const database = createTripDatabase(name, factory);
    try {
      await expect(database.trips.get(trip.id)).resolves.toEqual(trip);
      expect(database.verno).toBe(2);
      await expect(database.places.count()).resolves.toBe(0);
      await expect(database.transportSegments.count()).resolves.toBe(0);

      const place: Place = {
        id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
        tripId: trip.id,
        dayNumber: 2,
        dayOrder: 1,
        name: "岡山城",
        address: "",
        coordinates: null,
        arrivalTime: "11:30",
        stay: { kind: "none" },
        notes: "",
        createdAt: "2026-10-16T01:02:03.000Z",
        updatedAt: "2026-10-16T01:02:03.000Z",
      };
      await database.places.add(place);
      await expect(
        database.places.where("[tripId+dayNumber]").equals([trip.id, 2]).toArray(),
      ).resolves.toEqual([place]);
      await expect(
        database.transportSegments.where("[tripId+dayNumber]").equals([trip.id, 2]).count(),
      ).resolves.toBe(0);
    } finally {
      database.close();
      await database.delete();
    }
  });
});
