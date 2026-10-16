import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { TripList } from "../../../src/features/trips/TripList";
import type { Trip } from "../../../src/features/trips/tripSchema";

function makeTrip(
  id: string,
  name: string,
  startDate: string,
  endDate: string,
  destinations: string[] = ["岡山"],
): Trip {
  return {
    id,
    createdAt: "2026-10-16T01:02:03.000Z",
    updatedAt: "2026-10-16T01:02:03.000Z",
    name,
    destinations,
    startDate,
    endDate,
    budgetAmountMinor: null,
    budgetCurrency: null,
    companions: [],
    notes: "",
  };
}

describe("trip list", () => {
  it("shows every trip summary, groups by status, and sorts each group by start date", () => {
    const trips = [
      makeTrip("aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", "較晚出發", "2026-12-28", "2026-12-30"),
      makeTrip("bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb", "旅途中", "2026-12-19", "2026-12-22", ["岡山", "香川"]),
      makeTrip("cccccccc-cccc-4ccc-8ccc-cccccccccccc", "已結束", "2026-12-10", "2026-12-12"),
      makeTrip("dddddddd-dddd-4ddd-8ddd-dddddddddddd", "較早出發", "2026-12-24", "2026-12-26"),
      makeTrip("eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee", "單日旅程", "2026-12-20", "2026-12-20"),
    ];
    render(<TripList trips={trips} today="2026-12-20" />);

    const upcoming = within(screen.getByRole("region", { name: "即將出發" }));
    const ongoing = within(screen.getByRole("region", { name: "旅途中" }));
    const completed = within(screen.getByRole("region", { name: "已結束" }));

    expect(upcoming.getAllByRole("listitem").map((item) => item.textContent)).toEqual([
      expect.stringContaining("較早出發"),
      expect.stringContaining("較晚出發"),
    ]);
    const ongoingItems = ongoing.getAllByRole("listitem");
    expect(within(ongoingItems[0]!).getByText("旅途中")).toBeInTheDocument();
    expect(within(ongoingItems[1]!).getByText("單日旅程")).toBeInTheDocument();
    expect(ongoing.getByText("1 天")).toBeInTheDocument();
    expect(
      within(completed.getAllByRole("listitem")[0]!).getByText("已結束"),
    ).toBeInTheDocument();
    expect(screen.getByText("岡山・香川")).toBeInTheDocument();
    expect(screen.getByText("12.20")).toBeInTheDocument();
    expect(screen.getByText("12.22")).toBeInTheDocument();
    expect(screen.getAllByRole("listitem")).toHaveLength(5);
  });
});