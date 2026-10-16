import { describe, expect, it } from "vitest";
import {
  addDaysToDateOnly,
  getWeekdayShort,
  listTripDays,
} from "../../src/shared/dates/tripDates";

describe("trip days", () => {
  it("adds days across month, year and leap-day boundaries", () => {
    expect(addDaysToDateOnly("2026-12-31", 1)).toBe("2027-01-01");
    expect(addDaysToDateOnly("2028-02-28", 1)).toBe("2028-02-29");
    expect(addDaysToDateOnly("2028-02-29", 1)).toBe("2028-03-01");
    expect(addDaysToDateOnly("2027-02-28", 1)).toBe("2027-03-01");
    expect(addDaysToDateOnly("2026-12-10", 0)).toBe("2026-12-10");
  });

  it("returns English weekday abbreviations", () => {
    expect(getWeekdayShort("2026-12-10")).toBe("THU");
    expect(getWeekdayShort("2026-12-18")).toBe("FRI");
    expect(getWeekdayShort("2026-12-13")).toBe("SUN");
    expect(getWeekdayShort("2028-02-29")).toBe("TUE");
  });

  it("lists every trip day inclusively with magazine-style labels", () => {
    const days = listTripDays("2026-12-10", "2026-12-18");

    expect(days).toHaveLength(9);
    expect(days[0]).toEqual({ dayNumber: 1, date: "2026-12-10", label: "Day 1・12.10 THU" });
    expect(days[8]?.label).toBe("Day 9・12.18 FRI");
    expect(days.map((day) => day.dayNumber)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9]);
  });

  it("lists a single day when departure equals return", () => {
    expect(listTripDays("2026-12-10", "2026-12-10")).toEqual([
      { dayNumber: 1, date: "2026-12-10", label: "Day 1・12.10 THU" },
    ]);
  });

  it("lists days across the new year", () => {
    const days = listTripDays("2026-12-30", "2027-01-02");
    expect(days.map((day) => day.label)).toEqual([
      "Day 1・12.30 WED",
      "Day 2・12.31 THU",
      "Day 3・01.01 FRI",
      "Day 4・01.02 SAT",
    ]);
  });

  it("does not depend on the runtime time zone", () => {
    const originalTimeZone = process.env.TZ;
    try {
      process.env.TZ = "Pacific/Kiritimati";
      const east = listTripDays("2026-12-10", "2026-12-11");
      process.env.TZ = "Pacific/Pago_Pago";
      const west = listTripDays("2026-12-10", "2026-12-11");
      expect(east).toEqual(west);
      expect(east[0]?.label).toBe("Day 1・12.10 THU");
    } finally {
      process.env.TZ = originalTimeZone;
    }
  });
});
