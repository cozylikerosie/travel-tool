import { describe, expect, it } from "vitest";
import {
  compareDateOnly,
  getTodayLocalDate,
  getTripDurationDays,
  getTripStatus,
  isDateOnly,
} from "../../src/shared/dates/tripDates";

describe("date-only trip rules", () => {
  it("validates and compares normalized calendar dates", () => {
    expect(isDateOnly("2026-12-20")).toBe(true);
    expect(isDateOnly("2026-02-29")).toBe(false);
    expect(isDateOnly("2024-02-29")).toBe(true);
    expect(isDateOnly("2026-2-20")).toBe(false);
    expect(compareDateOnly("2026-12-19", "2026-12-20")).toBeLessThan(0);
    expect(compareDateOnly("2026-12-20", "2026-12-20")).toBe(0);
  });

  it("counts both endpoints across leap days and year boundaries", () => {
    expect(getTripDurationDays("2024-02-28", "2024-03-01")).toBe(3);
    expect(getTripDurationDays("2026-12-31", "2027-01-02")).toBe(3);
    expect(getTripDurationDays("2026-12-20", "2026-12-20")).toBe(1);
    expect(() => getTripDurationDays("2026-12-22", "2026-12-20")).toThrow();
  });

  it("classifies upcoming, ongoing, and completed trips inclusively", () => {
    expect(getTripStatus("2026-12-20", "2026-12-22", "2026-12-19")).toBe(
      "upcoming",
    );
    expect(getTripStatus("2026-12-20", "2026-12-22", "2026-12-20")).toBe(
      "ongoing",
    );
    expect(getTripStatus("2026-12-20", "2026-12-22", "2026-12-21")).toBe(
      "ongoing",
    );
    expect(getTripStatus("2026-12-20", "2026-12-22", "2026-12-22")).toBe(
      "ongoing",
    );
    expect(getTripStatus("2026-12-20", "2026-12-22", "2026-12-23")).toBe(
      "completed",
    );
  });

  it("uses local calendar components for today without timezone-shifting trip dates", () => {
    const originalTimeZone = process.env.TZ;
    const instant = new Date("2026-10-16T02:00:00.000Z");

    try {
      process.env.TZ = "Pacific/Honolulu";
      expect(getTodayLocalDate(instant)).toBe("2026-10-15");
      expect(getTripDurationDays("2026-10-16", "2026-10-17")).toBe(2);

      process.env.TZ = "Pacific/Kiritimati";
      expect(getTodayLocalDate(instant)).toBe("2026-10-16");
      expect(getTripDurationDays("2026-10-16", "2026-10-17")).toBe(2);
    } finally {
      process.env.TZ = originalTimeZone;
    }
  });
});