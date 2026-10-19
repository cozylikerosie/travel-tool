import { describe, expect, it } from "vitest";
import {
  ASIA_DEFAULT_BOUNDS,
  buildMapLines,
  buildMapMarkers,
  getMapViewport,
  lineClassName,
  resolveTileTheme,
} from "../../src/features/itinerary/mapModel";
import type { Place, TransportSegment } from "../../src/features/itinerary/itinerarySchema";
import { getTransportMode } from "../../src/features/itinerary/transportModes";

function place(id: string, arrivalTime: string, coordinates: Place["coordinates"], dayNumber = 1): Place {
  return {
    id,
    tripId: "trip",
    dayNumber,
    dayOrder: 1,
    name: `地點 ${id}`,
    address: "",
    coordinates,
    arrivalTime,
    stay: { kind: "none" },
    notes: "",
    createdAt: "2026-10-16T01:02:03.000Z",
    updatedAt: "2026-10-16T01:02:03.000Z",
  };
}

function segment(from: string, to: string, mode: TransportSegment["mode"]): TransportSegment {
  return {
    id: `${from}->${to}`,
    tripId: "trip",
    dayNumber: 1,
    fromPlaceId: from,
    toPlaceId: to,
    mode,
    updatedAt: "2026-10-16T01:02:03.000Z",
  };
}

const A = place("a", "09:00", { lat: 34.6672, lng: 133.9354 });
const B = place("b", "11:00", { lat: 34.665, lng: 133.936 });
const C = place("c", "14:00", { lat: 34.5951, lng: 133.772 });
const MANUAL = place("m", "10:00", null);

describe("buildMapMarkers", () => {
  it("numbers markers with the timeline order and skips places without coordinates", () => {
    const markers = buildMapMarkers([A, MANUAL, B, C], null);
    expect(markers.map((marker) => [marker.placeId, marker.order])).toEqual([
      ["a", 1],
      ["b", 3],
      ["c", 4],
    ]);
    expect(markers[0]).toMatchObject({ name: "地點 a", position: [34.6672, 133.9354], isSelected: false });
  });

  it("marks the selected place", () => {
    expect(buildMapMarkers([A, B], "b").map((marker) => marker.isSelected)).toEqual([false, true]);
  });

  it("returns no markers when no place has coordinates", () => {
    expect(buildMapMarkers([MANUAL], null)).toEqual([]);
  });
});

describe("buildMapLines", () => {
  it("connects adjacent places that both have coordinates, with the segment's style", () => {
    const lines = buildMapLines([A, B, C], [segment("a", "b", "walk")]);

    expect(lines).toHaveLength(2);
    expect(lines[0]).toMatchObject({
      id: "a->b",
      fromPlaceId: "a",
      toPlaceId: "b",
      mode: "walk",
      positions: [
        [34.6672, 133.9354],
        [34.665, 133.936],
      ],
      lineStyle: getTransportMode("walk").lineStyle,
    });
    expect(lines[0]?.className).toContain("map-line map-line--walk");
    expect(lines[1]).toMatchObject({ id: "b->c", mode: null, lineStyle: getTransportMode(null).lineStyle });
    expect(lines[1]?.className).toContain("map-line--unset");
  });

  it("bridges over manual places with an unset grey line", () => {
    const lines = buildMapLines([A, MANUAL, C], [segment("a", "m", "walk"), segment("m", "c", "rail")]);
    expect(lines).toEqual([
      expect.objectContaining({
        id: "a->c",
        fromPlaceId: "a",
        toPlaceId: "c",
        mode: null,
        bridgesManualPlaces: true,
        positions: [
          [34.6672, 133.9354],
          [34.5951, 133.772],
        ],
      }),
    ]);
    expect(lines[0]?.className).toContain("map-line--unset");
  });

  it("bridges several manual places in a row and keeps real segments", () => {
    const manualTwo = place("n", "10:30", null);
    const lines = buildMapLines([A, B, MANUAL, manualTwo, C], [segment("a", "b", "bus")]);
    expect(lines.map((line) => [line.id, line.mode, line.bridgesManualPlaces])).toEqual([
      ["a->b", "bus", false],
      ["b->c", null, true],
    ]);
  });

  it("draws nothing when fewer than two places have coordinates", () => {
    expect(buildMapLines([MANUAL, A], [])).toEqual([]);
  });

  it("never outputs colour codes", () => {
    const lines = buildMapLines([A, B, C], [segment("a", "b", "ferry"), segment("b", "c", "other")]);
    expect(JSON.stringify(lines)).not.toMatch(/#[0-9a-f]{3,6}/i);
    expect(lines[0]?.className).toContain("map-line--ferry");
    expect(lines[1]?.className).toContain("map-line--other");
  });
});

describe("lineClassName", () => {
  it("builds the colour class", () => {
    expect(lineClassName("rail")).toBe("map-line map-line--rail");
  });
});

describe("getMapViewport", () => {
  it("fits the day's coordinates", () => {
    expect(getMapViewport([A, C, MANUAL], [A, B, C])).toEqual({
      kind: "bounds",
      bounds: [
        [34.5951, 133.772],
        [34.6672, 133.9354],
      ],
    });
  });

  it("centres a single point at zoom 14", () => {
    expect(getMapViewport([B, MANUAL], [A, B, C])).toEqual({
      kind: "center",
      center: [34.665, 133.936],
      zoom: 14,
    });
  });

  it("falls back to every coordinate in the trip", () => {
    const otherDay = place("x", "09:00", { lat: 33.8, lng: 132.7 }, 3);
    expect(getMapViewport([MANUAL], [MANUAL, A, otherDay])).toEqual({
      kind: "bounds",
      bounds: [
        [33.8, 132.7],
        [34.6672, 133.9354],
      ],
    });
  });

  it("uses the Asia default when the trip has no coordinates", () => {
    expect(ASIA_DEFAULT_BOUNDS).toEqual([
      [-11, 92],
      [46, 146],
    ]);
    expect(getMapViewport([], [MANUAL])).toEqual({ kind: "bounds", bounds: ASIA_DEFAULT_BOUNDS });
  });
});

describe("resolveTileTheme", () => {
  it("prefers the explicit data-theme over the system preference", () => {
    expect(resolveTileTheme("light", true)).toBe("light");
    expect(resolveTileTheme("dark", false)).toBe("dark");
    expect(resolveTileTheme(null, true)).toBe("dark");
    expect(resolveTileTheme(null, false)).toBe("light");
  });
});
