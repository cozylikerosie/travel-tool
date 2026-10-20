import { z } from "zod";
import type { TripDatabase } from "./database";
import { tripDatabase } from "./database";
import { expenseSchema, type Expense } from "../features/expenses/expenseSchema";
import { sortExpenses } from "../features/expenses/expenseSummary";
import { placeSchema, transportSegmentSchema } from "../features/itinerary/itinerarySchema";
import { tripSchema, type Trip } from "../features/trips/tripSchema";

// 電腦與手機之間以使用者自行傳送的 JSON 檔交換資料，不經過任何遠端服務
export const ITINERARY_FILE_KIND = "travel-tool/itinerary";
export const EXPENSES_FILE_KIND = "travel-tool/expenses";
const FILE_VERSION = 1;

const itineraryFileSchema = z.object({
  kind: z.literal(ITINERARY_FILE_KIND),
  version: z.literal(FILE_VERSION),
  exportedAt: z.string(),
  trip: tripSchema,
  places: z.array(placeSchema),
  transportSegments: z.array(transportSegmentSchema),
});

const expensesFileSchema = z.object({
  kind: z.literal(EXPENSES_FILE_KIND),
  version: z.literal(FILE_VERSION),
  exportedAt: z.string(),
  tripId: z.string().uuid(),
  tripName: z.string(),
  expenses: z.array(expenseSchema),
});

export type ItineraryFile = z.infer<typeof itineraryFileSchema>;
export type ExpensesFile = z.infer<typeof expensesFileSchema>;

export interface ItineraryImportResult {
  trip: Trip;
  replaced: boolean;
}

export interface ExpensesImportResult {
  added: number;
  updated: number;
}

export interface TransferRepository {
  exportItinerary(tripId: string, now?: Date): Promise<ItineraryFile>;
  importItinerary(text: string): Promise<ItineraryImportResult>;
  exportExpenses(tripId: string, now?: Date): Promise<ExpensesFile>;
  importExpenses(tripId: string, text: string): Promise<ExpensesImportResult>;
}

function parseFile<T>(text: string, schema: z.ZodType<T>, kind: string, wrongKindMessage: string): T {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error("檔案不是有效的 JSON 格式");
  }
  if (typeof data !== "object" || data === null || (data as { kind?: unknown }).kind !== kind) {
    throw new Error(wrongKindMessage);
  }
  const result = schema.safeParse(data);
  if (!result.success) throw new Error("檔案內容不完整或已損毀，無法匯入");
  return result.data;
}

export function createTransferRepository(database: TripDatabase): TransferRepository {
  return {
    async exportItinerary(tripId, now = new Date()) {
      const trip = await database.trips.get(tripId);
      if (!trip) throw new Error("找不到要輸出的旅程");
      return {
        kind: ITINERARY_FILE_KIND,
        version: FILE_VERSION,
        exportedAt: now.toISOString(),
        trip,
        places: await database.places.where("tripId").equals(tripId).toArray(),
        transportSegments: await database.transportSegments.where("tripId").equals(tripId).toArray(),
      };
    },

    // 同一趟旅程再次匯入時，以檔案內容取代行程；手機上已記錄的花費保留
    async importItinerary(text) {
      const file = parseFile(text, itineraryFileSchema, ITINERARY_FILE_KIND, "這不是行程檔，請選擇從電腦輸出的行程檔");
      if (file.places.some((place) => place.tripId !== file.trip.id)
        || file.transportSegments.some((segment) => segment.tripId !== file.trip.id)) {
        throw new Error("檔案內容不完整或已損毀，無法匯入");
      }
      return database.transaction(
        "rw",
        [database.trips, database.places, database.transportSegments],
        async () => {
          const replaced = Boolean(await database.trips.get(file.trip.id));
          await database.places.where("tripId").equals(file.trip.id).delete();
          await database.transportSegments.where("tripId").equals(file.trip.id).delete();
          await database.trips.put(file.trip);
          await database.places.bulkPut(file.places);
          await database.transportSegments.bulkPut(file.transportSegments);
          return { trip: file.trip, replaced };
        },
      );
    },

    async exportExpenses(tripId, now = new Date()) {
      const trip = await database.trips.get(tripId);
      if (!trip) throw new Error("找不到要匯出花費的旅程");
      return {
        kind: EXPENSES_FILE_KIND,
        version: FILE_VERSION,
        exportedAt: now.toISOString(),
        tripId,
        tripName: trip.name,
        expenses: sortExpenses(await database.expenses.where("tripId").equals(tripId).toArray()),
      };
    },

    // 以花費識別碼合併，重複匯入同一個檔案不會重複計算
    async importExpenses(tripId, text) {
      const file = parseFile(text, expensesFileSchema, EXPENSES_FILE_KIND, "這不是花費檔，請選擇從手機匯出的花費檔");
      if (file.tripId !== tripId || file.expenses.some((expense) => expense.tripId !== tripId)) {
        throw new Error(`這份花費檔屬於「${file.tripName}」，不是目前的旅程`);
      }
      return database.transaction("rw", [database.trips, database.expenses], async () => {
        if (!(await database.trips.get(tripId))) throw new Error("找不到要匯入花費的旅程");
        const existing = await database.expenses.bulkGet(file.expenses.map((expense) => expense.id));
        const updated = existing.filter((expense): expense is Expense => Boolean(expense)).length;
        await database.expenses.bulkPut(file.expenses);
        return { added: file.expenses.length - updated, updated };
      });
    },
  };
}

export const transferRepository = createTransferRepository(tripDatabase);

export function itineraryFileName(trip: Trip): string {
  return `${trip.name}-行程.json`;
}

export function expensesFileName(trip: Trip): string {
  return `${trip.name}-花費.json`;
}
