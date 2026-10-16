import { describe, expect, it } from "vitest";
import { parseLocationInput } from "../../src/shared/geo/locationInput";

// 測試案例對應 specs/002-daily-itinerary-map/contracts/location-input.md
describe("parseLocationInput", () => {
  it("#1 parses plain coordinates with a space", () => {
    expect(parseLocationInput("34.6672, 133.9354")).toEqual({
      ok: true,
      coordinates: { lat: 34.6672, lng: 133.9354 },
    });
  });

  it("#2 parses plain coordinates without a space", () => {
    expect(parseLocationInput("34.6672,133.9354")).toEqual({
      ok: true,
      coordinates: { lat: 34.6672, lng: 133.9354 },
    });
  });

  it("#3 parses negative latitude with surrounding whitespace", () => {
    expect(parseLocationInput("  -33.8568 ,151.2153  ")).toEqual({
      ok: true,
      coordinates: { lat: -33.8568, lng: 151.2153 },
    });
  });

  it("#4 rejects out-of-range coordinates", () => {
    expect(parseLocationInput("91, 10")).toEqual({ ok: false, reason: "out-of-range" });
    expect(parseLocationInput("10, -181")).toEqual({ ok: false, reason: "out-of-range" });
  });

  it("#5 uses the @ map-centre coordinates when nothing better exists", () => {
    expect(parseLocationInput("https://www.google.com/maps/@34.6672,133.9354,15z")).toEqual({
      ok: true,
      coordinates: { lat: 34.6672, lng: 133.9354 },
    });
  });

  it("#6 prefers the place's own !3d!4d coordinates over @ and returns its name", () => {
    const url =
      "https://www.google.com/maps/place/岡山後樂園/@34.6680,133.9340,17z/data=!3m1!4b1!4m6!3m5!1s0x0:0x0!8m2!3d34.6672!4d133.9354";
    expect(parseLocationInput(url)).toEqual({
      ok: true,
      coordinates: { lat: 34.6672, lng: 133.9354 },
      name: "岡山後樂園",
    });
  });

  it("#7 decodes URL-encoded names and plus signs", () => {
    expect(
      parseLocationInput(
        "https://www.google.com/maps/place/%E5%B2%A1%E5%B1%B1%E5%9F%8E/@34.665,133.936,17z/data=!3d34.665!4d133.936",
      ),
    ).toMatchObject({ ok: true, name: "岡山城" });
    expect(
      parseLocationInput("https://www.google.com/maps/place/Okayama+Castle/@34.665,133.936,17z"),
    ).toMatchObject({ ok: true, name: "Okayama Castle" });
  });

  it("#8 treats regional Google domains the same as google.com", () => {
    for (const host of ["www.google.com.tw", "www.google.co.jp", "google.com"]) {
      expect(
        parseLocationInput(`https://${host}/maps/place/倉敷/@34.5955,133.7716,17z/data=!3d34.5951!4d133.7720`),
      ).toEqual({ ok: true, coordinates: { lat: 34.5951, lng: 133.772 }, name: "倉敷" });
    }
  });

  it("#9 reads coordinates from query parameters", () => {
    expect(
      parseLocationInput("https://www.google.com/maps/search/?api=1&query=34.6672,133.9354"),
    ).toEqual({ ok: true, coordinates: { lat: 34.6672, lng: 133.9354 } });
    expect(parseLocationInput("https://www.google.com/maps?q=34.6672,133.9354")).toMatchObject({ ok: true });
    expect(parseLocationInput("https://www.google.com/maps?ll=34.6672,133.9354")).toMatchObject({ ok: true });
    expect(
      parseLocationInput("https://www.google.com/maps/dir/?api=1&destination=34.6672,133.9354"),
    ).toMatchObject({ ok: true });
  });

  it("#10 #11 recognises mobile short links", () => {
    expect(parseLocationInput("https://maps.app.goo.gl/AbCdEf123")).toEqual({ ok: false, reason: "short-url" });
    expect(parseLocationInput("https://goo.gl/maps/AbCdEf123")).toEqual({ ok: false, reason: "short-url" });
    expect(parseLocationInput("https://g.co/kgs/AbCdEf")).toEqual({ ok: false, reason: "short-url" });
  });

  it("#12 rejects a place URL without coordinates", () => {
    expect(parseLocationInput("https://www.google.com/maps/place/岡山城/")).toEqual({
      ok: false,
      reason: "unrecognized",
    });
  });

  it("#13 rejects plain names and non-Google URLs", () => {
    expect(parseLocationInput("岡山後樂園")).toEqual({ ok: false, reason: "unrecognized" });
    expect(parseLocationInput("https://example.com/@34.6,133.9,15z")).toEqual({
      ok: false,
      reason: "unrecognized",
    });
  });

  it("#14 reports empty input", () => {
    expect(parseLocationInput("")).toEqual({ ok: false, reason: "empty" });
    expect(parseLocationInput("   ")).toEqual({ ok: false, reason: "empty" });
  });

  it("does not return a name that is itself a coordinate", () => {
    expect(
      parseLocationInput("https://www.google.com/maps/place/34.6672,133.9354/@34.6672,133.9354,17z"),
    ).toEqual({ ok: true, coordinates: { lat: 34.6672, lng: 133.9354 } });
  });

  it("reports out-of-range coordinates found inside a Google URL", () => {
    expect(parseLocationInput("https://www.google.com/maps/@95.1,133.9,15z")).toEqual({
      ok: false,
      reason: "out-of-range",
    });
  });
});
