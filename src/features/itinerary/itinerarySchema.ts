import { z } from "zod";
import { TRANSPORT_MODE_CODES } from "./transportModes";

const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;
const MAX_STAY_MINUTES = 1439;

function roundCoordinate(value: number): number {
  return Math.round(value * 1_000_000) / 1_000_000;
}

const timeSchema = (requiredMessage: string) =>
  z
    .string()
    .min(1, requiredMessage)
    .regex(TIME_PATTERN, "時間格式需為 HH:mm（24 小時制）");

export const coordinatesSchema = z
  .object({
    lat: z.number().min(-90, "緯度需在 −90 到 90 之間").max(90, "緯度需在 −90 到 90 之間"),
    lng: z.number().min(-180, "經度需在 −180 到 180 之間").max(180, "經度需在 −180 到 180 之間"),
  })
  .transform(({ lat, lng }) => ({ lat: roundCoordinate(lat), lng: roundCoordinate(lng) }));

export const staySchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("none") }),
  z.object({
    kind: z.literal("duration"),
    minutes: z.number().int().min(1).max(MAX_STAY_MINUTES),
  }),
  z.object({ kind: z.literal("departure"), time: timeSchema("請輸入離開時間") }),
]);

export const placeFieldsSchema = z
  .object({
    name: z.string().trim(),
    address: z.string().trim(),
    coordinates: coordinatesSchema.nullable(),
    arrivalTime: timeSchema("請輸入抵達時間"),
    stay: staySchema,
    notes: z.string(),
  })
  .superRefine((place, context) => {
    if (!place.name && place.coordinates === null) {
      context.addIssue({
        code: "custom",
        path: ["name"],
        message: "請輸入地點名稱或貼上座標",
      });
    }

    if (place.stay.kind === "departure" && place.stay.time < place.arrivalTime) {
      context.addIssue({
        code: "custom",
        path: ["stay"],
        message: "離開時間不可早於抵達時間",
      });
    }
  });

export const placeSchema = placeFieldsSchema.safeExtend({
  id: z.string().uuid("地點識別碼格式不正確"),
  tripId: z.string().uuid("旅程識別碼格式不正確"),
  dayNumber: z.number().int().positive(),
  dayOrder: z.number().int().positive(),
  createdAt: z.iso.datetime({ offset: false }),
  updatedAt: z.iso.datetime({ offset: false }),
});

const STAY_DURATION_MESSAGE = "停留時間需介於 1 分鐘到 23 小時 59 分鐘之間";

const rawPlaceFormSchema = z.object({
  name: z.string(),
  address: z.string(),
  coordinates: z.object({ lat: z.number(), lng: z.number() }).nullable(),
  arrivalTime: z.string(),
  stayKind: z.enum(["none", "duration", "departure"]),
  stayHours: z.string(),
  stayMinutes: z.string(),
  departureTime: z.string(),
  notes: z.string(),
});

function parseWholeNumber(value: string): number | null {
  const text = value.trim();
  if (!text) return 0;
  return /^\d+$/.test(text) ? Number(text) : null;
}

export const placeFormSchema = rawPlaceFormSchema
  .transform((form, context) => {
    let stay: z.input<typeof staySchema> = { kind: "none" };

    if (form.stayKind === "duration") {
      const hours = parseWholeNumber(form.stayHours);
      const minutes = parseWholeNumber(form.stayMinutes);
      const total = hours === null || minutes === null ? null : hours * 60 + minutes;
      if (total === null || total < 1 || total > MAX_STAY_MINUTES) {
        context.addIssue({ code: "custom", path: ["stayHours"], message: STAY_DURATION_MESSAGE });
        return z.NEVER;
      }
      stay = { kind: "duration", minutes: total };
    }

    if (form.stayKind === "departure") {
      stay = { kind: "departure", time: form.departureTime };
    }

    return {
      name: form.name,
      address: form.address,
      coordinates: form.coordinates,
      arrivalTime: form.arrivalTime,
      stay,
      notes: form.notes,
    };
  })
  .pipe(placeFieldsSchema);

export const transportSegmentSchema = z
  .object({
    id: z.string(),
    tripId: z.string().min(1),
    dayNumber: z.number().int().positive(),
    fromPlaceId: z.string().min(1),
    toPlaceId: z.string().min(1),
    mode: z.enum(TRANSPORT_MODE_CODES),
    updatedAt: z.iso.datetime({ offset: false }),
  })
  .refine((segment) => segment.id === `${segment.fromPlaceId}->${segment.toPlaceId}`, {
    path: ["id"],
    message: "交通段識別碼必須由起點與終點組成",
  });

export type Coordinates = z.infer<typeof coordinatesSchema>;
export type Stay = z.infer<typeof staySchema>;
export type PlaceFields = z.infer<typeof placeFieldsSchema>;
export type Place = z.infer<typeof placeSchema>;
export type PlaceFormInput = z.input<typeof placeFormSchema>;
export type TransportSegment = z.infer<typeof transportSegmentSchema>;

export function toMinutes(time: string): number {
  const [hours, minutes] = time.split(":").map(Number);
  return hours! * 60 + minutes!;
}

export function fromMinutes(total: number): string {
  const hours = String(Math.floor(total / 60)).padStart(2, "0");
  const minutes = String(total % 60).padStart(2, "0");
  return `${hours}:${minutes}`;
}

export function deriveDepartureTime(
  arrivalTime: string,
  minutes: number,
): { time: string; nextDay: boolean } {
  const total = toMinutes(arrivalTime) + minutes;
  return { time: fromMinutes(total % (24 * 60)), nextDay: total >= 24 * 60 };
}

export function deriveStayMinutes(arrivalTime: string, departureTime: string): number {
  return toMinutes(departureTime) - toMinutes(arrivalTime);
}
