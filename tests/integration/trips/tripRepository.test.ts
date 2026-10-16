import { IDBFactory } from "fake-indexeddb";
import { afterEach, describe, expect, it } from "vitest";
import { createTripDatabase } from "../../../src/data/database";
import { createTripRepository } from "../../../src/data/tripRepository";
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
});