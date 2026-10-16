import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { App } from "../../../src/app/App";
import { cleanupDatabases, nineDayTrip, setupItinerary, timelineNames } from "./helpers";

vi.mock("react-leaflet", () => import("../../mocks/reactLeaflet"));

afterEach(cleanupDatabases);

async function setupTrip() {
  const context = await setupItinerary();
  const kept = await context.addPlace(2, "直島", "10:00");
  const d8a = await context.addPlace(8, "道後溫泉", "09:00");
  const d8b = await context.addPlace(8, "松山城", "13:00");
  const d9 = await context.addPlace(9, "松山機場", "08:00");
  await context.setMode(8, d8a.id, d8b.id, "bus");
  render(<App itineraryRepository={context.itineraryRepository} repository={context.tripRepository} />);
  const user = userEvent.setup();
  await user.click(await screen.findByRole("button", { name: `查看旅程：${nineDayTrip.name}` }));
  await user.click(screen.getByRole("button", { name: "編輯旅程" }));
  return { ...context, user, kept, d8a, d8b, d9 };
}

function changeDates(startDate: string, endDate: string) {
  fireEvent.change(screen.getByLabelText("出發日期"), { target: { value: startDate } });
  fireEvent.change(screen.getByLabelText("回程日期"), { target: { value: endDate } });
}

async function placesBeyondDay7(context: Awaited<ReturnType<typeof setupTrip>>) {
  return context.itineraryRepository.countPlacesBeyondDay(context.trip.id, 7);
}

describe("US4 旅程日期變更", () => {
  it("warns before removing days that have places and changes nothing until the user chooses", async () => {
    const context = await setupTrip();
    changeDates("2026-12-10", "2026-12-16");
    await context.user.click(screen.getByRole("button", { name: "儲存修改" }));

    const dialog = await screen.findByRole("dialog", { name: "旅程天數將減少" });
    expect(dialog).toHaveTextContent("Day 8、Day 9");
    expect(dialog).toHaveTextContent("3 個地點");
    await expect(context.tripRepository.getById(context.trip.id)).resolves.toEqual(nineDayTrip);
    await expect(placesBeyondDay7(context)).resolves.toEqual({ dayNumbers: [8, 9], placeCount: 3 });
  });

  it("keeps the trip dates and the form input when cancelled", async () => {
    const context = await setupTrip();
    changeDates("2026-12-10", "2026-12-16");
    await context.user.click(screen.getByRole("button", { name: "儲存修改" }));
    const dialog = await screen.findByRole("dialog", { name: "旅程天數將減少" });

    await context.user.click(within(dialog).getByRole("button", { name: "取消" }));

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(await screen.findByText("已取消日期變更，旅程未修改。")).toBeInTheDocument();
    expect(screen.getByLabelText("回程日期")).toHaveValue("2026-12-16");
    await expect(context.tripRepository.getById(context.trip.id)).resolves.toEqual(nineDayTrip);
    await expect(placesBeyondDay7(context)).resolves.toEqual({ dayNumbers: [8, 9], placeCount: 3 });
  });

  it("moves the affected places into a kept day", async () => {
    const context = await setupTrip();
    changeDates("2026-12-10", "2026-12-16");
    await context.user.click(screen.getByRole("button", { name: "儲存修改" }));
    const dialog = await screen.findByRole("dialog", { name: "旅程天數將減少" });

    await context.user.selectOptions(within(dialog).getByLabelText("移到哪一天"), "Day 2・12.11 FRI");
    await context.user.click(within(dialog).getByRole("button", { name: "移到 Day 2" }));

    expect(await screen.findByRole("button", { name: "每日行程" })).toBeInTheDocument();
    await expect(context.tripRepository.getById(context.trip.id)).resolves.toMatchObject({ endDate: "2026-12-16" });
    await expect(placesBeyondDay7(context)).resolves.toEqual({ dayNumbers: [], placeCount: 0 });
    const day2 = await context.itineraryRepository.listPlacesForDay(context.trip.id, 2);
    expect(day2.map((place) => place.name)).toEqual(["松山機場", "道後溫泉", "直島", "松山城"]);
  });

  it("deletes the affected places and their segments", async () => {
    const context = await setupTrip();
    changeDates("2026-12-10", "2026-12-16");
    await context.user.click(screen.getByRole("button", { name: "儲存修改" }));
    const dialog = await screen.findByRole("dialog", { name: "旅程天數將減少" });

    await context.user.click(within(dialog).getByRole("button", { name: "刪除這些地點" }));

    expect(await screen.findByRole("button", { name: "每日行程" })).toBeInTheDocument();
    await expect(context.tripRepository.getById(context.trip.id)).resolves.toMatchObject({ endDate: "2026-12-16" });
    expect((await context.itineraryRepository.listPlacesForTrip(context.trip.id)).map((place) => place.name)).toEqual([
      "直島",
    ]);
    await expect(context.database.transportSegments.count()).resolves.toBe(0);
  });

  it("does not warn when the whole trip shifts and keeps places on their Day N", async () => {
    const context = await setupTrip();
    changeDates("2026-12-11", "2026-12-19");
    await context.user.click(screen.getByRole("button", { name: "儲存修改" }));

    await context.user.click(await screen.findByRole("button", { name: "每日行程" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    await context.user.click(await screen.findByRole("tab", { name: "Day 9・12.19 SAT" }));
    await waitFor(async () => expect(await timelineNames()).toEqual(["松山機場"]));
  });

  it("does not warn when the removed days are empty", async () => {
    const context = await setupTrip();
    await context.itineraryRepository.deletePlace(context.d9.id);
    changeDates("2026-12-10", "2026-12-17");
    await context.user.click(screen.getByRole("button", { name: "儲存修改" }));

    expect(await screen.findByRole("button", { name: "每日行程" })).toBeInTheDocument();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    await expect(context.tripRepository.getById(context.trip.id)).resolves.toMatchObject({ endDate: "2026-12-17" });
  });

  it("does not warn when the trip gets longer and adds empty days", async () => {
    const context = await setupTrip();
    changeDates("2026-12-10", "2026-12-20");
    await context.user.click(screen.getByRole("button", { name: "儲存修改" }));

    await context.user.click(await screen.findByRole("button", { name: "每日行程" }));
    expect(await screen.findAllByRole("tab")).toHaveLength(11);
    await context.user.click(screen.getByRole("tab", { name: "Day 10・12.19 SAT" }));
    expect(await screen.findByText("這一天還沒有安排地點")).toBeInTheDocument();
    await context.user.click(screen.getByRole("tab", { name: "Day 9・12.18 FRI" }));
    await waitFor(async () => expect(await timelineNames()).toEqual(["松山機場"]));
  });
});
