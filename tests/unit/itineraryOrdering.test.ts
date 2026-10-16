import { describe, expect, it } from "vitest";
import {
  arrivalTimeForReorder,
  findStaleSegmentIds,
  listAdjacentPairs,
  moveItem,
  nextDayOrder,
  sortPlaces,
} from "../../src/features/itinerary/itineraryOrdering";
import type { Place, TransportSegment } from "../../src/features/itinerary/itinerarySchema";

function place(id: string, arrivalTime: string, dayOrder: number): Place {
  return {
    id,
    tripId: "trip",
    dayNumber: 1,
    dayOrder,
    name: id,
    address: "",
    coordinates: null,
    arrivalTime,
    stay: { kind: "none" },
    notes: "",
    createdAt: "2026-10-16T01:02:03.000Z",
    updatedAt: "2026-10-16T01:02:03.000Z",
  };
}

function segment(from: string, to: string): TransportSegment {
  return {
    id: `${from}->${to}`,
    tripId: "trip",
    dayNumber: 1,
    fromPlaceId: from,
    toPlaceId: to,
    mode: "walk",
    updatedAt: "2026-10-16T01:02:03.000Z",
  };
}

describe("itinerary ordering", () => {
  it("sorts by arrival time, then by the order places were added", () => {
    const kurashiki = place("倉敷", "14:00", 2);
    const korakuen = place("後樂園", "09:00", 1);
    const castle = place("岡山城", "11:30", 3);
    expect(sortPlaces([kurashiki, korakuen, castle]).map((item) => item.id)).toEqual([
      "後樂園",
      "岡山城",
      "倉敷",
    ]);

    const second = place("second", "10:00", 2);
    const first = place("first", "10:00", 1);
    expect(sortPlaces([second, first]).map((item) => item.id)).toEqual(["first", "second"]);
  });

  it("does not mutate its input", () => {
    const places = [place("b", "10:00", 2), place("a", "09:00", 1)];
    sortPlaces(places);
    expect(places.map((item) => item.id)).toEqual(["b", "a"]);
  });

  it("lists adjacent pairs", () => {
    expect(listAdjacentPairs([])).toEqual([]);
    expect(listAdjacentPairs([place("a", "09:00", 1)])).toEqual([]);
    const a = place("a", "09:00", 1);
    const b = place("b", "10:00", 2);
    const c = place("c", "11:00", 3);
    expect(listAdjacentPairs([a, b, c])).toEqual([
      [a, b],
      [b, c],
    ]);
  });

  it("finds segments whose endpoints are no longer adjacent", () => {
    const a = place("a", "09:00", 1);
    const b = place("b", "10:00", 2);
    const c = place("c", "11:00", 3);
    const segments = [segment("a", "b"), segment("b", "c"), segment("a", "c"), segment("c", "x")];

    expect(findStaleSegmentIds([a, b, c], segments)).toEqual(["a->c", "c->x"]);
  });

  it("treats a swapped pair as stale", () => {
    const a = place("a", "09:00", 1);
    const b = place("b", "10:00", 2);
    expect(findStaleSegmentIds([b, a], [segment("a", "b")])).toEqual(["a->b"]);
  });

  it("assigns the next day order", () => {
    expect(nextDayOrder([])).toBe(1);
    expect(nextDayOrder([place("a", "09:00", 3), place("b", "10:00", 7)])).toBe(8);
  });
});

describe("drag reorder arrival time", () => {
  const korakuen = place("後樂園", "09:00", 1);
  const castle = place("岡山城", "11:30", 2);
  const kurashiki = place("倉敷", "14:00", 3);
  const day = [korakuen, castle, kurashiki];

  it("moves an item within a list", () => {
    expect(moveItem(["a", "b", "c"], 2, 0)).toEqual(["c", "a", "b"]);
    expect(moveItem(["a", "b", "c"], 0, 2)).toEqual(["b", "c", "a"]);
  });

  it("uses 30 minutes before the new next place when dragged to the top", () => {
    expect(arrivalTimeForReorder(day, 2, 0)).toBe("08:30");
  });

  it("uses the midpoint between the new neighbours", () => {
    expect(arrivalTimeForReorder(day, 2, 1)).toBe("10:15");
    expect(arrivalTimeForReorder(day, 0, 1)).toBe("12:45");
  });

  it("uses 30 minutes after the new previous place when dragged to the end", () => {
    expect(arrivalTimeForReorder(day, 0, 2)).toBe("14:30");
  });

  it("stays within the day", () => {
    expect(arrivalTimeForReorder([place("a", "00:10", 1), place("b", "05:00", 2)], 1, 0)).toBe("00:00");
    expect(arrivalTimeForReorder([place("a", "05:00", 1), place("b", "23:50", 2)], 0, 1)).toBe("23:59");
  });

  it("floors the midpoint to the minute", () => {
    expect(arrivalTimeForReorder([place("a", "09:00", 1), place("b", "09:01", 2), place("c", "12:00", 3)], 2, 1)).toBe(
      "09:00",
    );
  });
});
