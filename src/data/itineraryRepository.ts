import type { TripDatabase } from "./database";
import { tripDatabase } from "./database";
import {
  placeSchema,
  toMinutes,
  transportSegmentSchema,
  type Place,
  type PlaceFields,
  type TransportSegment,
} from "../features/itinerary/itinerarySchema";
import {
  arrivalTimeForReorder,
  findStaleSegmentIds,
  listAdjacentPairs,
  moveItem,
  nextDayOrder,
  segmentId,
  sortPlaces,
} from "../features/itinerary/itineraryOrdering";
import type { TransportModeCode } from "../features/itinerary/transportModes";
import { tripSchema, type Trip } from "../features/trips/tripSchema";
import { getTripDurationDays } from "../shared/dates/tripDates";

export type RemovedDaysResolution = { action: "delete" } | { action: "move"; targetDayNumber: number };

export interface PlacesBeyondDay {
  dayNumbers: number[];
  placeCount: number;
}

export interface WriteOptions {
  createId?: () => string;
  now?: () => Date;
}

export interface ItineraryRepository {
  listPlacesForDay(tripId: string, dayNumber: number): Promise<Place[]>;
  listPlacesForTrip(tripId: string): Promise<Place[]>;
  listSegmentsForDay(tripId: string, dayNumber: number): Promise<TransportSegment[]>;
  addPlace(tripId: string, dayNumber: number, fields: PlaceFields, options?: WriteOptions): Promise<Place>;
  updatePlace(placeId: string, fields: PlaceFields, options?: WriteOptions): Promise<Place>;
  setTransportMode(
    tripId: string,
    dayNumber: number,
    fromPlaceId: string,
    toPlaceId: string,
    mode: TransportModeCode | null,
    options?: WriteOptions,
  ): Promise<void>;
  reorderPlace(
    tripId: string,
    dayNumber: number,
    placeId: string,
    toIndex: number,
    options?: WriteOptions,
  ): Promise<Place>;
  deletePlace(placeId: string): Promise<void>;
  movePlace(placeId: string, targetDayNumber: number, options?: WriteOptions): Promise<Place>;
  countPlacesBeyondDay(tripId: string, dayCount: number): Promise<PlacesBeyondDay>;
  updateTripWithRemovedDays(trip: Trip, resolution: RemovedDaysResolution): Promise<void>;
}

function currentTime(options: WriteOptions): string {
  return (options.now ?? (() => new Date()))().toISOString();
}

function validatePlace(candidate: unknown): Place {
  const result = placeSchema.safeParse(candidate);
  if (!result.success) {
    throw new Error(result.error.issues[0]?.message ?? "地點資料不正確");
  }
  return result.data;
}

export function createItineraryRepository(database: TripDatabase): ItineraryRepository {
  function dayKey(tripId: string, dayNumber: number) {
    return [tripId, dayNumber];
  }

  async function readDay(tripId: string, dayNumber: number) {
    return sortPlaces(
      await database.places.where("[tripId+dayNumber]").equals(dayKey(tripId, dayNumber)).toArray(),
    );
  }

  // 每次會改變順序的寫入後呼叫；必須在同一個交易內執行
  async function removeStaleSegments(tripId: string, dayNumber: number) {
    const places = await readDay(tripId, dayNumber);
    const segments = await database.transportSegments
      .where("[tripId+dayNumber]")
      .equals(dayKey(tripId, dayNumber))
      .toArray();
    const staleIds = findStaleSegmentIds(places, segments);
    if (staleIds.length) await database.transportSegments.bulkDelete(staleIds);
  }

  return {
    listPlacesForDay: readDay,

    async listPlacesForTrip(tripId) {
      const places = await database.places.where("tripId").equals(tripId).toArray();
      return sortPlaces(places).sort((left, right) => left.dayNumber - right.dayNumber);
    },

    listSegmentsForDay(tripId, dayNumber) {
      return database.transportSegments
        .where("[tripId+dayNumber]")
        .equals(dayKey(tripId, dayNumber))
        .toArray();
    },

    async addPlace(tripId, dayNumber, fields, options = {}) {
      return database.transaction("rw", [database.places, database.transportSegments], async () => {
        const now = currentTime(options);
        const place = validatePlace({
          ...fields,
          id: (options.createId ?? (() => crypto.randomUUID()))(),
          tripId,
          dayNumber,
          dayOrder: nextDayOrder(await readDay(tripId, dayNumber)),
          createdAt: now,
          updatedAt: now,
        });
        await database.places.add(place);
        await removeStaleSegments(tripId, dayNumber);
        return place;
      });
    },

    async updatePlace(placeId, fields, options = {}) {
      return database.transaction("rw", [database.places, database.transportSegments], async () => {
        const existing = await database.places.get(placeId);
        if (!existing) throw new Error("找不到要更新的地點");
        const place = validatePlace({
          ...fields,
          id: existing.id,
          tripId: existing.tripId,
          dayNumber: existing.dayNumber,
          dayOrder: existing.dayOrder,
          createdAt: existing.createdAt,
          updatedAt: currentTime(options),
        });
        await database.places.put(place);
        await removeStaleSegments(place.tripId, place.dayNumber);
        return place;
      });
    },

    async setTransportMode(tripId, dayNumber, fromPlaceId, toPlaceId, mode, options = {}) {
      await database.transaction("rw", [database.places, database.transportSegments], async () => {
        const isAdjacent = listAdjacentPairs(await readDay(tripId, dayNumber)).some(
          ([from, to]) => from.id === fromPlaceId && to.id === toPlaceId,
        );
        if (!isAdjacent) throw new Error("只能為相鄰的兩個地點設定交通方式");

        const id = segmentId(fromPlaceId, toPlaceId);
        if (mode === null) {
          await database.transportSegments.delete(id);
          return;
        }

        const result = transportSegmentSchema.safeParse({
          id,
          tripId,
          dayNumber,
          fromPlaceId,
          toPlaceId,
          mode,
          updatedAt: currentTime(options),
        });
        if (!result.success) throw new Error("交通方式資料不正確");
        await database.transportSegments.put(result.data);
      });
    },

    async reorderPlace(tripId, dayNumber, placeId, toIndex, options = {}) {
      return database.transaction("rw", [database.places, database.transportSegments], async () => {
        const places = await readDay(tripId, dayNumber);
        const fromIndex = places.findIndex((place) => place.id === placeId);
        if (fromIndex < 0) throw new Error("找不到要移動的地點");
        if (!Number.isInteger(toIndex) || toIndex < 0 || toIndex >= places.length) {
          throw new Error("目標位置不正確");
        }
        if (fromIndex === toIndex) return places[fromIndex]!;

        const original = places[fromIndex]!;
        const arrivalTime = arrivalTimeForReorder(places, fromIndex, toIndex);
        let { stay } = original;
        // 原本的離開時間若早於新的抵達時間，改以原停留長度保存
        if (stay.kind === "departure" && stay.time < arrivalTime) {
          const minutes = toMinutes(stay.time) - toMinutes(original.arrivalTime);
          stay = minutes >= 1 ? { kind: "duration", minutes } : { kind: "none" };
        }
        const now = currentTime(options);
        const moved = validatePlace({ ...original, arrivalTime, stay, updatedAt: now });

        // 依新順序重新編排加入順序，讓同一時間的地點也維持拖曳後的位置
        const reordered = moveItem(places, fromIndex, toIndex).map((place, index) =>
          place.id === moved.id ? { ...moved, dayOrder: index + 1 } : { ...place, dayOrder: index + 1 },
        );
        await database.places.bulkPut(reordered);
        await removeStaleSegments(tripId, dayNumber);
        return reordered[toIndex]!;
      });
    },

    async deletePlace(placeId) {
      await database.transaction("rw", [database.places, database.transportSegments], async () => {
        const existing = await database.places.get(placeId);
        if (!existing) return;
        await database.places.delete(placeId);
        await removeStaleSegments(existing.tripId, existing.dayNumber);
      });
    },

    async movePlace(placeId, targetDayNumber, options = {}) {
      return database.transaction("rw", [database.places, database.transportSegments], async () => {
        const existing = await database.places.get(placeId);
        if (!existing) throw new Error("找不到要移動的地點");
        // 移入的地點視為目標天最後加入
        const place = validatePlace({
          ...existing,
          dayNumber: targetDayNumber,
          dayOrder: nextDayOrder(await readDay(existing.tripId, targetDayNumber)),
          updatedAt: currentTime(options),
        });
        await database.places.put(place);
        await removeStaleSegments(existing.tripId, existing.dayNumber);
        await removeStaleSegments(existing.tripId, targetDayNumber);
        return place;
      });
    },

    async countPlacesBeyondDay(tripId, dayCount) {
      const places = await database.places.where("tripId").equals(tripId).toArray();
      const beyond = places.filter((place) => place.dayNumber > dayCount);
      return {
        dayNumbers: [...new Set(beyond.map((place) => place.dayNumber))].sort((left, right) => left - right),
        placeCount: beyond.length,
      };
    },

    async updateTripWithRemovedDays(trip, resolution) {
      const result = tripSchema.safeParse(trip);
      if (!result.success) throw new Error("旅程資料不正確");
      const dayCount = getTripDurationDays(trip.startDate, trip.endDate);
      if (
        resolution.action === "move" &&
        (!Number.isInteger(resolution.targetDayNumber) ||
          resolution.targetDayNumber < 1 ||
          resolution.targetDayNumber > dayCount)
      ) {
        throw new Error("目標日不在新的旅程日期內");
      }

      await database.transaction(
        "rw",
        [database.trips, database.places, database.transportSegments],
        async () => {
          if (!(await database.trips.get(trip.id))) throw new Error("找不到要更新的旅程");
          await database.trips.put(result.data);

          // 依原本的天與時間軸順序搬移
          const removed = sortPlaces(
            (await database.places.where("tripId").equals(trip.id).toArray()).filter(
              (place) => place.dayNumber > dayCount,
            ),
          ).sort((left, right) => left.dayNumber - right.dayNumber);
          const removedIds = new Set(removed.map((place) => place.id));
          const removedSegmentIds = (await database.transportSegments.where("tripId").equals(trip.id).toArray())
            .filter((segment) => segment.dayNumber > dayCount || removedIds.has(segment.fromPlaceId) || removedIds.has(segment.toPlaceId))
            .map((segment) => segment.id);
          await database.transportSegments.bulkDelete(removedSegmentIds);

          if (resolution.action === "delete") {
            await database.places.bulkDelete([...removedIds]);
            return;
          }

          let dayOrder = nextDayOrder(await readDay(trip.id, resolution.targetDayNumber));
          const now = new Date().toISOString();
          for (const place of removed) {
            await database.places.put(
              validatePlace({ ...place, dayNumber: resolution.targetDayNumber, dayOrder, updatedAt: now }),
            );
            dayOrder += 1;
          }
          await removeStaleSegments(trip.id, resolution.targetDayNumber);
        },
      );
    },
  };
}

export const itineraryRepository = createItineraryRepository(tripDatabase);
