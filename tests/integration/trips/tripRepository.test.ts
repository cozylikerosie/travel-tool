import { IDBFactory } from "fake-indexeddb";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createTripDatabase } from "../../../src/data/database";
import { createTripRepository } from "../../../src/data/tripRepository";
import type { Place, TransportSegment } from "../../../src/features/itinerary/itinerarySchema";
import type { Trip } from "../../../src/features/trips/tripSchema";

const makeTrip = (id: string, startDate: string, name = "旅程"): Trip => ({
  id,
  createdAt: "2026-10-16T01:02:03.000Z",
  updatedAt: "2026-10-16T01:02:03.000Z",
  name,
  destinations: ["岡山"],
  startDate,
  endDate: startDate,
  budgetAmountMinor: null,
  budgetCurrency: null,
  companions: [],
  notes: "",
});

describe("trip repository", () => {
  const databases: ReturnType<typeof createTripDatabase>[] = [];

  afterEach(async () => {
    await Promise.all(
      databases.splice(0).map(async (database) => {
        database.close();
        await database.delete();
      }),
    );
  });

  it("writes a Trip, closes and reopens the database, then reads the same record", async () => {
    const factory = new IDBFactory();
    const databaseName = `trip-persistence-${crypto.randomUUID()}`;
    const firstDatabase = createTripDatabase(databaseName, factory);
    databases.push(firstDatabase);
    const firstRepository = createTripRepository(firstDatabase);
    const trip = makeTrip("3d8dfb88-6a9f-4ef6-8cc5-7084fa8cab2f", "2026-12-20");

    await firstRepository.create(trip);
    firstDatabase.close();

    const reopenedDatabase = createTripDatabase(databaseName, factory);
    databases.push(reopenedDatabase);
    const reopenedRepository = createTripRepository(reopenedDatabase);

    await expect(reopenedRepository.getById(trip.id)).resolves.toEqual(trip);
  });

  it("supports create, read, update, delete, and start-date ordered listing", async () => {
    const database = createTripDatabase(
      `trip-crud-${crypto.randomUUID()}`,
      new IDBFactory(),
    );
    databases.push(database);
    const repository = createTripRepository(database);
    const laterTrip = makeTrip("aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", "2027-01-10", "較晚");
    const earlierTrip = makeTrip("bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb", "2026-12-20", "較早");

    await repository.create(laterTrip);
    await repository.create(earlierTrip);
    expect(await repository.listAll()).toEqual([earlierTrip, laterTrip]);

    const updatedTrip = { ...earlierTrip, name: "已更新", updatedAt: "2026-10-17T00:00:00.000Z" };
    await repository.update(updatedTrip);
    await expect(repository.getById(earlierTrip.id)).resolves.toEqual(updatedTrip);

    await repository.delete(laterTrip.id);
    await expect(repository.getById(laterTrip.id)).resolves.toBeUndefined();
  });

  describe("deleting a trip with a daily itinerary", () => {
    const tripA = makeTrip("aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", "2026-12-10", "甲");
    const tripB = makeTrip("bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb", "2026-12-20", "乙");

    function makePlace(id: string, tripId: string): Place {
      return {
        id,
        tripId,
        dayNumber: 1,
        dayOrder: 1,
        name: id,
        address: "",
        coordinates: null,
        arrivalTime: "09:00",
        stay: { kind: "none" },
        notes: "",
        createdAt: "2026-10-16T01:02:03.000Z",
        updatedAt: "2026-10-16T01:02:03.000Z",
      };
    }

    function makeSegment(from: string, to: string, tripId: string): TransportSegment {
      return {
        id: `${from}->${to}`,
        tripId,
        dayNumber: 1,
        fromPlaceId: from,
        toPlaceId: to,
        mode: "rail",
        updatedAt: "2026-10-16T01:02:03.000Z",
      };
    }

    async function seed() {
      const database = createTripDatabase(`trip-cascade-${crypto.randomUUID()}`, new IDBFactory());
      databases.push(database);
      const repository = createTripRepository(database);
      await repository.create(tripA);
      await repository.create(tripB);
      await database.places.bulkAdd([
        makePlace("a1", tripA.id),
        makePlace("a2", tripA.id),
        makePlace("b1", tripB.id),
        makePlace("b2", tripB.id),
      ]);
      await database.transportSegments.bulkAdd([
        makeSegment("a1", "a2", tripA.id),
        makeSegment("b1", "b2", tripB.id),
      ]);
      return { database, repository };
    }

    it("removes the trip's places and transport segments in the same transaction", async () => {
      const { database, repository } = await seed();

      await repository.delete(tripA.id);

      await expect(repository.getById(tripA.id)).resolves.toBeUndefined();
      expect((await database.places.toArray()).map((item) => item.id).sort()).toEqual(["b1", "b2"]);
      expect((await database.transportSegments.toArray()).map((item) => item.id)).toEqual(["b1->b2"]);
    });

    it("leaves everything unchanged when the transaction fails", async () => {
      const { database, repository } = await seed();
      vi.spyOn(database.transportSegments, "where").mockImplementation(() => {
        throw new Error("模擬寫入失敗");
      });

      await expect(repository.delete(tripA.id)).rejects.toThrow("模擬寫入失敗");

      await expect(repository.getById(tripA.id)).resolves.toEqual(tripA);
      await expect(database.places.count()).resolves.toBe(4);
      await expect(database.transportSegments.count()).resolves.toBe(2);
    });
  });
});