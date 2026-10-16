import { IDBFactory } from "fake-indexeddb";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createTripDatabase, type TripDatabase } from "../../../src/data/database";
import { createItineraryRepository } from "../../../src/data/itineraryRepository";
import type { PlaceFields, TransportSegment } from "../../../src/features/itinerary/itinerarySchema";
import type { Trip } from "../../../src/features/trips/tripSchema";

const TRIP_ID = "3d8dfb88-6a9f-4ef6-8cc5-7084fa8cab2f";
const NOW = new Date("2026-10-16T12:00:00.000Z");

const trip: Trip = {
  id: TRIP_ID,
  createdAt: "2026-10-16T01:02:03.000Z",
  updatedAt: "2026-10-16T01:02:03.000Z",
  name: "四國之旅",
  destinations: ["岡山"],
  startDate: "2026-12-10",
  endDate: "2026-12-18",
  budgetAmountMinor: null,
  budgetCurrency: null,
  companions: [],
  notes: "",
};

function fields(name: string, arrivalTime: string, overrides: Partial<PlaceFields> = {}): PlaceFields {
  return {
    name,
    address: "",
    coordinates: null,
    arrivalTime,
    stay: { kind: "none" },
    notes: "",
    ...overrides,
  };
}

let idCounter = 0;
function nextId(): string {
  idCounter += 1;
  return `00000000-0000-4000-8000-${String(idCounter).padStart(12, "0")}`;
}

const databases: TripDatabase[] = [];

afterEach(async () => {
  const active = databases.splice(0);
  for (const database of active) database.close();
  await Promise.all(active.map((database) => database.delete()));
});

async function setup(name = `itinerary-${crypto.randomUUID()}`, factory = new IDBFactory()) {
  const database = createTripDatabase(name, factory);
  databases.push(database);
  await database.trips.put(trip);
  const repository = createItineraryRepository(database);
  const add = (dayNumber: number, placeFields: PlaceFields) =>
    repository.addPlace(TRIP_ID, dayNumber, placeFields, { createId: nextId, now: () => NOW });
  return { database, repository, add, name, factory };
}

function segment(from: string, to: string, dayNumber = 1): TransportSegment {
  return {
    id: `${from}->${to}`,
    tripId: TRIP_ID,
    dayNumber,
    fromPlaceId: from,
    toPlaceId: to,
    mode: "walk",
    updatedAt: NOW.toISOString(),
  };
}

const names = (places: { name: string }[]) => places.map((place) => place.name);

describe("US1 地點新增與讀取", () => {
  it("assigns id, timestamps and the next day order", async () => {
    const { repository, add } = await setup();

    const first = await add(1, fields("岡山後樂園", "09:00"));
    const second = await add(1, fields("倉敷", "14:00"));
    const otherDay = await add(2, fields("直島", "10:00"));

    expect(first).toMatchObject({
      tripId: TRIP_ID,
      dayNumber: 1,
      dayOrder: 1,
      createdAt: NOW.toISOString(),
      updatedAt: NOW.toISOString(),
    });
    expect(first.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(second.dayOrder).toBe(2);
    expect(otherDay.dayOrder).toBe(1);
    await expect(repository.listPlacesForTrip(TRIP_ID)).resolves.toHaveLength(3);
  });

  it("uses crypto.randomUUID by default", async () => {
    const { repository } = await setup();
    const place = await repository.addPlace(TRIP_ID, 1, fields("岡山城", "11:30"));
    expect(place.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  });

  it("lists a day's places sorted by arrival time and day order", async () => {
    const { repository, add } = await setup();
    await add(1, fields("岡山後樂園", "09:00"));
    await add(1, fields("倉敷美觀地區", "14:00"));
    await add(1, fields("岡山城", "11:30"));
    await add(1, fields("同時抵達", "14:00"));

    expect(names(await repository.listPlacesForDay(TRIP_ID, 1))).toEqual([
      "岡山後樂園",
      "岡山城",
      "倉敷美觀地區",
      "同時抵達",
    ]);
    await expect(repository.listPlacesForDay(TRIP_ID, 2)).resolves.toEqual([]);
  });

  it("rejects invalid places without writing", async () => {
    const { database, add } = await setup();

    await expect(add(1, fields("", "09:00"))).rejects.toThrow("請輸入地點名稱或貼上座標");
    await expect(add(1, fields("岡山城", ""))).rejects.toThrow("請輸入抵達時間");
    await expect(database.places.count()).resolves.toBe(0);
  });

  it("removes a transport segment that is no longer adjacent after an insert", async () => {
    const { database, repository, add } = await setup();
    const a = await add(1, fields("A", "09:00"));
    const c = await add(1, fields("C", "14:00"));
    await database.transportSegments.put(segment(a.id, c.id));

    await add(1, fields("B", "11:00"));

    await expect(repository.listSegmentsForDay(TRIP_ID, 1)).resolves.toEqual([]);
  });

  it("keeps a segment when the inserted place does not split it", async () => {
    const { repository, database, add } = await setup();
    const a = await add(1, fields("A", "09:00"));
    const b = await add(1, fields("B", "10:00"));
    await database.transportSegments.put(segment(a.id, b.id));

    await add(1, fields("C", "15:00"));

    await expect(repository.listSegmentsForDay(TRIP_ID, 1)).resolves.toEqual([segment(a.id, b.id)]);
  });

  it("keeps places after the database is closed and reopened", async () => {
    const { database, add, name, factory } = await setup();
    await add(1, fields("岡山後樂園", "09:00", { coordinates: { lat: 34.6672, lng: 133.9354 } }));
    database.close();

    const reopened = createTripDatabase(name, factory);
    databases.push(reopened);
    const places = await createItineraryRepository(reopened).listPlacesForDay(TRIP_ID, 1);
    expect(places).toHaveLength(1);
    expect(places[0]).toMatchObject({ name: "岡山後樂園", coordinates: { lat: 34.6672, lng: 133.9354 } });
  });
});

describe("US2 交通段", () => {
  async function threePlaces() {
    const context = await setup();
    const a = await context.add(1, fields("A", "09:00"));
    const b = await context.add(1, fields("B", "11:00"));
    const c = await context.add(1, fields("C", "14:00"));
    return { ...context, a, b, c };
  }

  it("stores a mode for an adjacent pair keyed by its endpoints", async () => {
    const { repository, a, b } = await threePlaces();

    await repository.setTransportMode(TRIP_ID, 1, a.id, b.id, "rail", { now: () => NOW });

    await expect(repository.listSegmentsForDay(TRIP_ID, 1)).resolves.toEqual([
      {
        id: `${a.id}->${b.id}`,
        tripId: TRIP_ID,
        dayNumber: 1,
        fromPlaceId: a.id,
        toPlaceId: b.id,
        mode: "rail",
        updatedAt: NOW.toISOString(),
      },
    ]);

    await repository.setTransportMode(TRIP_ID, 1, a.id, b.id, "walk");
    const [updated] = await repository.listSegmentsForDay(TRIP_ID, 1);
    expect(updated?.mode).toBe("walk");
  });

  it("rejects pairs that are not adjacent in sorted order", async () => {
    const { repository, a, b, c } = await threePlaces();

    await expect(repository.setTransportMode(TRIP_ID, 1, a.id, c.id, "bus")).rejects.toThrow();
    await expect(repository.setTransportMode(TRIP_ID, 1, b.id, a.id, "bus")).rejects.toThrow();
    await expect(repository.listSegmentsForDay(TRIP_ID, 1)).resolves.toEqual([]);
  });

  it("deletes the record when set back to unset", async () => {
    const { repository, a, b } = await threePlaces();
    await repository.setTransportMode(TRIP_ID, 1, a.id, b.id, "taxi");

    await repository.setTransportMode(TRIP_ID, 1, a.id, b.id, null);

    await expect(repository.listSegmentsForDay(TRIP_ID, 1)).resolves.toEqual([]);
  });

  it("resets only segments whose adjacency changes when an arrival time moves", async () => {
    const { repository, a, b, c, database } = await threePlaces();
    const d = await repository.addPlace(TRIP_ID, 1, fields("D", "16:00"));
    await repository.setTransportMode(TRIP_ID, 1, a.id, b.id, "walk");
    await repository.setTransportMode(TRIP_ID, 1, b.id, c.id, "rail");
    await repository.setTransportMode(TRIP_ID, 1, c.id, d.id, "bus");

    // A 移到 B、C 之間：A→B、B→C 失效，C→D 保留
    await repository.updatePlace(a.id, { ...fields("A", "12:00") }, { now: () => new Date("2026-10-17T00:00:00.000Z") });

    expect(names(await repository.listPlacesForDay(TRIP_ID, 1))).toEqual(["B", "A", "C", "D"]);
    expect((await repository.listSegmentsForDay(TRIP_ID, 1)).map((item) => item.id)).toEqual([
      `${c.id}->${d.id}`,
    ]);
    const stored = await database.places.get(a.id);
    expect(stored).toMatchObject({
      dayOrder: a.dayOrder,
      createdAt: a.createdAt,
      updatedAt: "2026-10-17T00:00:00.000Z",
    });
  });

  it("does not revive a reset setting when the original order returns", async () => {
    const { repository, a, b } = await threePlaces();
    await repository.setTransportMode(TRIP_ID, 1, a.id, b.id, "walk");

    await repository.updatePlace(a.id, fields("A", "12:00"));
    await repository.updatePlace(a.id, fields("A", "09:00"));

    await expect(repository.listSegmentsForDay(TRIP_ID, 1)).resolves.toEqual([]);
  });

  it("rejects invalid updates without writing", async () => {
    const { repository, database, a } = await threePlaces();

    await expect(repository.updatePlace(a.id, fields("A", "25:00"))).rejects.toThrow();
    await expect(repository.updatePlace("missing", fields("A", "09:00"))).rejects.toThrow("找不到要更新的地點");
    await expect(database.places.get(a.id)).resolves.toEqual(a);
  });
});

describe("US4 編輯、刪除、移動與日期變更", () => {
  it("adds, corrects and removes coordinates", async () => {
    const { repository, add } = await setup();
    const place = await add(1, fields("倉敷", "14:00"));

    await repository.updatePlace(place.id, fields("倉敷", "14:00", { coordinates: { lat: 34.59, lng: 133.77 } }));
    expect((await repository.listPlacesForDay(TRIP_ID, 1))[0]?.coordinates).toEqual({ lat: 34.59, lng: 133.77 });

    await repository.updatePlace(place.id, fields("倉敷", "14:00", { coordinates: { lat: 34.5951, lng: 133.772 } }));
    expect((await repository.listPlacesForDay(TRIP_ID, 1))[0]?.coordinates).toEqual({ lat: 34.5951, lng: 133.772 });

    await repository.updatePlace(place.id, fields("倉敷", "14:00", { coordinates: null }));
    expect((await repository.listPlacesForDay(TRIP_ID, 1))[0]?.coordinates).toBeNull();
  });

  it("deletes a place with its segments and leaves the new gap unset", async () => {
    const { repository, add } = await setup();
    const a = await add(1, fields("A", "09:00"));
    const b = await add(1, fields("B", "11:00"));
    const c = await add(1, fields("C", "14:00"));
    await repository.setTransportMode(TRIP_ID, 1, a.id, b.id, "walk");
    await repository.setTransportMode(TRIP_ID, 1, b.id, c.id, "rail");

    await repository.deletePlace(b.id);

    expect(names(await repository.listPlacesForDay(TRIP_ID, 1))).toEqual(["A", "C"]);
    await expect(repository.listSegmentsForDay(TRIP_ID, 1)).resolves.toEqual([]);
  });

  it("moves a place to another day as its last-added place and cleans both days", async () => {
    const { repository, add } = await setup();
    const a = await add(1, fields("A", "09:00"));
    const b = await add(1, fields("B", "11:00"));
    const c = await add(1, fields("C", "14:00"));
    const x = await add(3, fields("X", "10:00"));
    const y = await add(3, fields("Y", "11:00"));
    const z = await add(3, fields("Z", "15:00"));
    await repository.setTransportMode(TRIP_ID, 1, a.id, b.id, "walk");
    await repository.setTransportMode(TRIP_ID, 1, b.id, c.id, "rail");
    await repository.setTransportMode(TRIP_ID, 3, x.id, y.id, "bus");
    await repository.setTransportMode(TRIP_ID, 3, y.id, z.id, "ferry");

    const moved = await repository.movePlace(b.id, 3, { now: () => new Date("2026-10-18T00:00:00.000Z") });

    expect(moved).toMatchObject({ dayNumber: 3, dayOrder: 4, updatedAt: "2026-10-18T00:00:00.000Z" });
    expect(names(await repository.listPlacesForDay(TRIP_ID, 1))).toEqual(["A", "C"]);
    // B 與 Y 同為 11:00，移入的 B 視為最後加入，排在 Y 之後
    expect(names(await repository.listPlacesForDay(TRIP_ID, 3))).toEqual(["X", "Y", "B", "Z"]);
    await expect(repository.listSegmentsForDay(TRIP_ID, 1)).resolves.toEqual([]);
    expect((await repository.listSegmentsForDay(TRIP_ID, 3)).map((item) => item.mode)).toEqual(["bus"]);
  });

  it("places a moved place after existing ones with the same arrival time", async () => {
    const { repository, add } = await setup();
    const early = await add(1, fields("移入", "10:00"));
    await add(2, fields("原本", "10:00"));

    await repository.movePlace(early.id, 2);

    expect(names(await repository.listPlacesForDay(TRIP_ID, 2))).toEqual(["原本", "移入"]);
  });

  it("counts places beyond a day", async () => {
    const { repository, add } = await setup();
    await add(7, fields("七", "09:00"));
    await add(8, fields("八", "09:00"));
    await add(9, fields("九甲", "09:00"));
    await add(9, fields("九乙", "10:00"));

    await expect(repository.countPlacesBeyondDay(TRIP_ID, 7)).resolves.toEqual({ dayNumbers: [8, 9], placeCount: 3 });
    await expect(repository.countPlacesBeyondDay(TRIP_ID, 9)).resolves.toEqual({ dayNumbers: [], placeCount: 0 });
  });

  async function shortenedTripSetup() {
    const context = await setup();
    const kept = await context.add(2, fields("保留", "12:00"));
    const d8a = await context.add(8, fields("八甲", "09:00"));
    const d8b = await context.add(8, fields("八乙", "10:00"));
    const d9 = await context.add(9, fields("九", "08:00"));
    await context.repository.setTransportMode(TRIP_ID, 8, d8a.id, d8b.id, "walk");
    const shortened: Trip = { ...trip, endDate: "2026-12-16", updatedAt: "2026-10-18T00:00:00.000Z" };
    return { ...context, kept, d8a, d8b, d9, shortened };
  }

  it("updates the trip and deletes places on removed days in one transaction", async () => {
    const { repository, database, shortened } = await shortenedTripSetup();

    await repository.updateTripWithRemovedDays(shortened, { action: "delete" });

    await expect(database.trips.get(TRIP_ID)).resolves.toEqual(shortened);
    expect(names(await repository.listPlacesForTrip(TRIP_ID))).toEqual(["保留"]);
    await expect(database.transportSegments.count()).resolves.toBe(0);
  });

  it("moves places from removed days into a kept day in their original order", async () => {
    const { repository, database, shortened, kept } = await shortenedTripSetup();

    await repository.updateTripWithRemovedDays(shortened, { action: "move", targetDayNumber: 2 });

    await expect(database.trips.get(TRIP_ID)).resolves.toEqual(shortened);
    const day2 = await repository.listPlacesForDay(TRIP_ID, 2);
    expect(names(day2)).toEqual(["九", "八甲", "八乙", "保留"]);
    expect(day2.find((place) => place.name === "保留")?.dayOrder).toBe(kept.dayOrder);
    expect(day2.filter((place) => place.name !== "保留").map((place) => place.dayOrder).sort()).toEqual([2, 3, 4]);
    await expect(repository.countPlacesBeyondDay(TRIP_ID, 7)).resolves.toEqual({ dayNumbers: [], placeCount: 0 });
    await expect(database.transportSegments.count()).resolves.toBe(0);
  });

  it("rejects a target day outside the new trip and changes nothing", async () => {
    const { repository, database, shortened } = await shortenedTripSetup();

    await expect(
      repository.updateTripWithRemovedDays(shortened, { action: "move", targetDayNumber: 8 }),
    ).rejects.toThrow();

    await expect(database.trips.get(TRIP_ID)).resolves.toEqual(trip);
    await expect(repository.countPlacesBeyondDay(TRIP_ID, 7)).resolves.toEqual({ dayNumbers: [8, 9], placeCount: 3 });
  });

  it("rolls back the trip update when a later step fails", async () => {
    const { repository, database, shortened } = await shortenedTripSetup();
    vi.spyOn(database.transportSegments, "bulkDelete").mockImplementation(() => {
      throw new Error("模擬寫入失敗");
    });

    await expect(repository.updateTripWithRemovedDays(shortened, { action: "delete" })).rejects.toThrow("模擬寫入失敗");

    await expect(database.trips.get(TRIP_ID)).resolves.toEqual(trip);
    await expect(database.places.count()).resolves.toBe(4);
  });
});

describe("拖曳調整順序", () => {
  async function day() {
    const context = await setup();
    const korakuen = await context.add(1, fields("後樂園", "09:00"));
    const castle = await context.add(1, fields("岡山城", "11:30"));
    const kurashiki = await context.add(1, fields("倉敷", "14:00"));
    await context.repository.setTransportMode(TRIP_ID, 1, korakuen.id, castle.id, "walk");
    await context.repository.setTransportMode(TRIP_ID, 1, castle.id, kurashiki.id, "rail");
    return { ...context, korakuen, castle, kurashiki };
  }

  it("changes only the dragged place's arrival time and keeps the new order", async () => {
    const { repository, kurashiki, korakuen, castle } = await day();

    const moved = await repository.reorderPlace(TRIP_ID, 1, kurashiki.id, 0, { now: () => NOW });

    expect(moved).toMatchObject({ id: kurashiki.id, arrivalTime: "08:30", updatedAt: NOW.toISOString() });
    const places = await repository.listPlacesForDay(TRIP_ID, 1);
    expect(names(places)).toEqual(["倉敷", "後樂園", "岡山城"]);
    expect(places.find((place) => place.id === korakuen.id)?.arrivalTime).toBe("09:00");
    expect(places.find((place) => place.id === castle.id)?.arrivalTime).toBe("11:30");
  });

  it("keeps segments whose endpoints stay adjacent and resets the rest", async () => {
    const { repository, kurashiki, korakuen, castle } = await day();

    await repository.reorderPlace(TRIP_ID, 1, kurashiki.id, 0);

    // 新順序：倉敷 → 後樂園 → 岡山城；後樂園 → 岡山城 保留步行
    expect(await repository.listSegmentsForDay(TRIP_ID, 1)).toEqual([
      expect.objectContaining({ id: `${korakuen.id}->${castle.id}`, mode: "walk" }),
    ]);
  });

  it("keeps the dragged position when neighbours share a time", async () => {
    const { repository, add } = await setup();
    await add(1, fields("A", "09:00"));
    await add(1, fields("B", "09:01"));
    const c = await add(1, fields("C", "12:00"));

    await repository.reorderPlace(TRIP_ID, 1, c.id, 1);

    const places = await repository.listPlacesForDay(TRIP_ID, 1);
    expect(names(places)).toEqual(["A", "C", "B"]);
    expect(places[1]?.arrivalTime).toBe("09:00");
  });

  it("converts a departure time that would fall before the new arrival into a duration", async () => {
    const { repository, add } = await setup();
    const early = await add(1, fields("早", "08:00", { stay: { kind: "departure", time: "09:00" } }));
    await add(1, fields("晚", "15:00"));

    const moved = await repository.reorderPlace(TRIP_ID, 1, early.id, 1);

    expect(moved).toMatchObject({ arrivalTime: "15:30", stay: { kind: "duration", minutes: 60 } });
  });

  it("rejects an invalid target position without writing", async () => {
    const { repository, kurashiki } = await day();

    await expect(repository.reorderPlace(TRIP_ID, 1, kurashiki.id, 5)).rejects.toThrow("目標位置不正確");
    expect(names(await repository.listPlacesForDay(TRIP_ID, 1))).toEqual(["後樂園", "岡山城", "倉敷"]);
  });
});
