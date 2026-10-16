import Dexie, { type Table } from "dexie";
import type { Trip } from "../features/trips/tripSchema";

export const DATABASE_NAME = "personal-travel-tool";

export class TripDatabase extends Dexie {
  trips!: Table<Trip, string>;

  constructor(
    name = DATABASE_NAME,
    indexedDBFactory: IDBFactory = globalThis.indexedDB,
  ) {
    super(name, { indexedDB: indexedDBFactory });
    this.version(1).stores({
      trips: "id,startDate,endDate",
    });
  }
}

export function createTripDatabase(
  name = DATABASE_NAME,
  indexedDBFactory: IDBFactory = globalThis.indexedDB,
): TripDatabase {
  return new TripDatabase(name, indexedDBFactory);
}

export const tripDatabase = createTripDatabase();