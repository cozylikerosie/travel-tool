import Dexie, { type Table } from "dexie";
import type { Place, TransportSegment } from "../features/itinerary/itinerarySchema";
import type { Trip } from "../features/trips/tripSchema";

export const DATABASE_NAME = "personal-travel-tool";

export class TripDatabase extends Dexie {
  trips!: Table<Trip, string>;
  places!: Table<Place, string>;
  transportSegments!: Table<TransportSegment, string>;

  constructor(
    name = DATABASE_NAME,
    indexedDBFactory: IDBFactory = globalThis.indexedDB,
  ) {
    super(name, { indexedDB: indexedDBFactory });
    this.version(1).stores({
      trips: "id,startDate,endDate",
    });
    // 002：只新增每日行程資料表，既有 trips 不需轉換
    this.version(2).stores({
      trips: "id,startDate,endDate",
      places: "id, tripId, [tripId+dayNumber]",
      transportSegments: "id, tripId, [tripId+dayNumber]",
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