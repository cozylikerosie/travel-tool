import type { TripDatabase } from "./database";
import { tripDatabase } from "./database";
import type { Trip } from "../features/trips/tripSchema";

export interface TripRepository {
  create(trip: Trip): Promise<void>;
  getById(id: string): Promise<Trip | undefined>;
  update(trip: Trip): Promise<void>;
  delete(id: string): Promise<void>;
  listAll(): Promise<Trip[]>;
}

export function createTripRepository(database: TripDatabase): TripRepository {
  return {
    async create(trip) {
      await database.transaction("rw", database.trips, () =>
        database.trips.add(trip),
      );
    },

    getById(id) {
      return database.trips.get(id);
    },

    async update(trip) {
      await database.transaction("rw", database.trips, async () => {
        const existingTrip = await database.trips.get(trip.id);
        if (!existingTrip) {
          throw new Error("找不到要更新的旅程");
        }
        await database.trips.put(trip);
      });
    },

    async delete(id) {
      await database.transaction(
        "rw",
        [database.trips, database.places, database.transportSegments],
        async () => {
          await database.trips.delete(id);
          await database.places.where("tripId").equals(id).delete();
          await database.transportSegments.where("tripId").equals(id).delete();
        },
      );
    },

    async listAll() {
      const trips = await database.trips.orderBy("startDate").toArray();
      return trips.sort((left, right) => {
        const nameOrder = left.name.localeCompare(right.name, "zh-Hant");
        return left.startDate.localeCompare(right.startDate) || nameOrder || left.id.localeCompare(right.id);
      });
    },
  };
}

export const tripRepository = createTripRepository(tripDatabase);