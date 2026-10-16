import { describe, expect, it } from "vitest";
import { buildGoogleMapsDirectionsUrl, type PlaceEndpoint } from "../../src/shared/geo/googleMapsUrls";

// 測試案例對應 specs/002-daily-itinerary-map/contracts/google-maps-urls.md
const korakuen: PlaceEndpoint = { name: "岡山後樂園", address: "", coordinates: { lat: 34.6672, lng: 133.9354 } };
const castle: PlaceEndpoint = { name: "岡山城", address: "", coordinates: { lat: 34.665, lng: 133.936 } };

function params(url: string | null) {
  expect(url).not.toBeNull();
  return new URL(url!).searchParams;
}

describe("buildGoogleMapsDirectionsUrl", () => {
  it("#1 uses coordinates and transit for rail with a fixed parameter order", () => {
    expect(buildGoogleMapsDirectionsUrl(korakuen, castle, "rail")).toBe(
      "https://www.google.com/maps/dir/?api=1&origin=34.6672%2C133.9354&destination=34.665%2C133.936&travelmode=transit",
    );
  });

  it("#2 maps walking", () => {
    expect(params(buildGoogleMapsDirectionsUrl(korakuen, castle, "walk")).get("travelmode")).toBe("walking");
  });

  it("#3 maps taxi and drive to driving", () => {
    expect(params(buildGoogleMapsDirectionsUrl(korakuen, castle, "taxi")).get("travelmode")).toBe("driving");
    expect(params(buildGoogleMapsDirectionsUrl(korakuen, castle, "drive")).get("travelmode")).toBe("driving");
  });

  it("#4 omits travelmode for flight, other and unset", () => {
    for (const mode of ["flight", "other", null] as const) {
      const url = buildGoogleMapsDirectionsUrl(korakuen, castle, mode);
      expect(params(url).has("travelmode")).toBe(false);
      expect(url).toBe(
        "https://www.google.com/maps/dir/?api=1&origin=34.6672%2C133.9354&destination=34.665%2C133.936",
      );
    }
  });

  it("#5 uses name and address when an endpoint has no coordinates", () => {
    const manual: PlaceEndpoint = { name: "岡山城", address: "岡山市北区丸の内2-3-1", coordinates: null };
    const search = params(buildGoogleMapsDirectionsUrl(manual, korakuen, "bus"));
    expect(search.get("origin")).toBe("岡山城, 岡山市北区丸の内2-3-1");
    expect(search.get("destination")).toBe("34.6672,133.9354");
    expect(search.get("travelmode")).toBe("transit");
  });

  it("#6 uses names on both ends", () => {
    const from: PlaceEndpoint = { name: "高松港", address: "", coordinates: null };
    const to: PlaceEndpoint = { name: "直島 宮浦港", address: "", coordinates: null };
    const search = params(buildGoogleMapsDirectionsUrl(from, to, "ferry"));
    expect(search.get("origin")).toBe("高松港");
    expect(search.get("destination")).toBe("直島 宮浦港");
    expect(search.get("travelmode")).toBe("transit");
  });

  it("#7 returns null when an endpoint has neither coordinates nor a name", () => {
    const empty: PlaceEndpoint = { name: "  ", address: "地址", coordinates: null };
    expect(buildGoogleMapsDirectionsUrl(empty, castle, "rail")).toBeNull();
    expect(buildGoogleMapsDirectionsUrl(castle, empty, null)).toBeNull();
  });
});
