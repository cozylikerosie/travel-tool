import { describe, expect, it } from "vitest";
import {
  deriveDepartureTime,
  deriveStayMinutes,
  placeFormSchema,
  placeSchema,
  transportSegmentSchema,
  type Place,
  type PlaceFormInput,
} from "../../src/features/itinerary/itinerarySchema";

const TRIP_ID = "3d8dfb88-6a9f-4ef6-8cc5-7084fa8cab2f";
const PLACE_A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const PLACE_B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

const basePlace: Place = {
  id: PLACE_A,
  tripId: TRIP_ID,
  dayNumber: 1,
  dayOrder: 1,
  name: "岡山後樂園",
  address: "",
  coordinates: { lat: 34.6672, lng: 133.9354 },
  arrivalTime: "09:00",
  stay: { kind: "none" },
  notes: "",
  createdAt: "2026-10-16T01:02:03.000Z",
  updatedAt: "2026-10-16T01:02:03.000Z",
};

const baseForm: PlaceFormInput = {
  name: "岡山城",
  address: "",
  coordinates: null,
  arrivalTime: "11:30",
  stayKind: "none",
  stayHours: "",
  stayMinutes: "",
  departureTime: "",
  notes: "",
};

function messagesOf(result: { success: boolean; error?: { issues: { message: string }[] } }) {
  return result.error?.issues.map((issue) => issue.message) ?? [];
}

describe("place schema", () => {
  it("accepts a complete place", () => {
    expect(placeSchema.parse(basePlace)).toEqual(basePlace);
  });

  it("requires a name or coordinates", () => {
    const result = placeSchema.safeParse({ ...basePlace, name: "   ", coordinates: null });
    expect(result.success).toBe(false);
    expect(messagesOf(result)).toContain("請輸入地點名稱或貼上座標");

    expect(placeSchema.safeParse({ ...basePlace, name: "", coordinates: { lat: 1, lng: 2 } }).success).toBe(true);
    expect(placeSchema.safeParse({ ...basePlace, name: "倉敷", coordinates: null }).success).toBe(true);
  });

  it("trims name and address, keeps notes whitespace", () => {
    const parsed = placeSchema.parse({ ...basePlace, name: "  岡山城 ", address: " 岡山市 ", notes: "  早點到 " });
    expect(parsed.name).toBe("岡山城");
    expect(parsed.address).toBe("岡山市");
    expect(parsed.notes).toBe("  早點到 ");
  });

  it("validates arrival time as zero-padded 24-hour HH:mm", () => {
    expect(messagesOf(placeSchema.safeParse({ ...basePlace, arrivalTime: "" }))).toContain("請輸入抵達時間");
    for (const invalid of ["9:00", "24:00", "12:60", "12:5"]) {
      expect(placeSchema.safeParse({ ...basePlace, arrivalTime: invalid }).success).toBe(false);
    }
    for (const valid of ["00:00", "23:59", "09:05"]) {
      expect(placeSchema.safeParse({ ...basePlace, arrivalTime: valid }).success).toBe(true);
    }
  });

  it("limits coordinates to valid ranges and rounds to 6 decimals", () => {
    expect(placeSchema.safeParse({ ...basePlace, coordinates: { lat: 90.0001, lng: 0 } }).success).toBe(false);
    expect(placeSchema.safeParse({ ...basePlace, coordinates: { lat: 0, lng: -180.5 } }).success).toBe(false);
    expect(placeSchema.safeParse({ ...basePlace, coordinates: { lat: -90, lng: 180 } }).success).toBe(true);

    const parsed = placeSchema.parse({ ...basePlace, coordinates: { lat: 34.66721234, lng: 133.93549876 } });
    expect(parsed.coordinates).toEqual({ lat: 34.667212, lng: 133.935499 });
  });

  it("accepts only the three stay variants", () => {
    expect(placeSchema.safeParse({ ...basePlace, stay: { kind: "duration", minutes: 90 } }).success).toBe(true);
    expect(placeSchema.safeParse({ ...basePlace, stay: { kind: "duration", minutes: 0 } }).success).toBe(false);
    expect(placeSchema.safeParse({ ...basePlace, stay: { kind: "duration", minutes: 1440 } }).success).toBe(false);
    expect(placeSchema.safeParse({ ...basePlace, stay: { kind: "duration", minutes: 1.5 } }).success).toBe(false);
    expect(placeSchema.safeParse({ ...basePlace, stay: { kind: "departure", time: "10:30" } }).success).toBe(true);
    expect(placeSchema.safeParse({ ...basePlace, stay: { kind: "other" } }).success).toBe(false);
  });

  it("rejects a departure time earlier than arrival", () => {
    const result = placeSchema.safeParse({ ...basePlace, stay: { kind: "departure", time: "08:59" } });
    expect(messagesOf(result)).toContain("離開時間不可早於抵達時間");
    expect(placeSchema.safeParse({ ...basePlace, stay: { kind: "departure", time: "09:00" } }).success).toBe(true);
  });
});

describe("place form schema", () => {
  it("converts form values into place fields", () => {
    const parsed = placeFormSchema.parse({
      ...baseForm,
      address: "岡山市北区丸の内2-3-1",
      stayKind: "duration",
      stayHours: "1",
      stayMinutes: "30",
    });
    expect(parsed).toEqual({
      name: "岡山城",
      address: "岡山市北区丸の内2-3-1",
      coordinates: null,
      arrivalTime: "11:30",
      stay: { kind: "duration", minutes: 90 },
      notes: "",
    });
  });

  it("reports a missing arrival time", () => {
    expect(messagesOf(placeFormSchema.safeParse({ ...baseForm, arrivalTime: "" }))).toContain("請輸入抵達時間");
  });

  it("validates stay duration and departure inputs", () => {
    expect(
      messagesOf(placeFormSchema.safeParse({ ...baseForm, stayKind: "duration", stayHours: "", stayMinutes: "" })),
    ).toContain("停留時間需介於 1 分鐘到 23 小時 59 分鐘之間");
    expect(
      placeFormSchema.safeParse({ ...baseForm, stayKind: "duration", stayHours: "24", stayMinutes: "0" }).success,
    ).toBe(false);
    expect(
      messagesOf(placeFormSchema.safeParse({ ...baseForm, stayKind: "departure", departureTime: "" })),
    ).toContain("請輸入離開時間");
    expect(
      messagesOf(placeFormSchema.safeParse({ ...baseForm, stayKind: "departure", departureTime: "11:00" })),
    ).toContain("離開時間不可早於抵達時間");
    expect(
      placeFormSchema.parse({ ...baseForm, stayKind: "departure", departureTime: "12:15" }).stay,
    ).toEqual({ kind: "departure", time: "12:15" });
  });
});

describe("transport segment schema", () => {
  const segment = {
    id: `${PLACE_A}->${PLACE_B}`,
    tripId: TRIP_ID,
    dayNumber: 1,
    fromPlaceId: PLACE_A,
    toPlaceId: PLACE_B,
    mode: "walk",
    updatedAt: "2026-10-16T01:02:03.000Z",
  };

  it("accepts the eight transport modes", () => {
    for (const mode of ["rail", "bus", "ferry", "taxi", "walk", "drive", "flight", "other"]) {
      expect(transportSegmentSchema.safeParse({ ...segment, mode }).success).toBe(true);
    }
    expect(transportSegmentSchema.safeParse({ ...segment, mode: "bike" }).success).toBe(false);
  });

  it("requires the id to match its endpoints", () => {
    expect(transportSegmentSchema.safeParse({ ...segment, id: `${PLACE_B}->${PLACE_A}` }).success).toBe(false);
  });
});

describe("stay time helpers", () => {
  it("derives departure time from a duration", () => {
    expect(deriveDepartureTime("09:00", 90)).toEqual({ time: "10:30", nextDay: false });
    expect(deriveDepartureTime("23:00", 120)).toEqual({ time: "01:00", nextDay: true });
  });

  it("derives a duration from a departure time", () => {
    expect(deriveStayMinutes("09:00", "10:30")).toBe(90);
  });
});
