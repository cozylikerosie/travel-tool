import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DayItineraryPage } from "../../../src/features/itinerary/DayItineraryPage";
import { cleanupDatabases, setupItinerary, timelineNames } from "./helpers";

vi.mock("react-leaflet", () => import("../../mocks/reactLeaflet"));

afterEach(async () => {
  vi.restoreAllMocks();
  // dnd-kit 在拖曳結束後短暫攔截 document click，等它解除以免影響下一個測試
  await new Promise((resolve) => setTimeout(resolve, 60));
  await cleanupDatabases();
});

function mockSortableRects() {
  vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(function (this: HTMLElement) {
    const index = this.getAttribute("data-sort-index");
    if (index !== null) return new DOMRect(0, Number(index) * 160, 600, 150);
    return new DOMRect(0, 0, 600, 150);
  });
}

async function setupDay() {
  const context = await setupItinerary();
  const korakuen = await context.addPlace(1, "岡山後樂園", "09:00");
  const castle = await context.addPlace(1, "岡山城", "11:30");
  const kurashiki = await context.addPlace(1, "倉敷美觀地區", "14:00");
  await context.setMode(1, korakuen.id, castle.id, "walk");
  await context.setMode(1, castle.id, kurashiki.id, "rail");
  mockSortableRects();
  render(<DayItineraryPage onBack={vi.fn()} repository={context.itineraryRepository} trip={context.trip} />);
  await screen.findByRole("list", { name: /的地點$/ });
  return { ...context, korakuen, castle, kurashiki };
}

async function dragWithKeyboard(name: string, steps: number, key: "ArrowUp" | "ArrowDown") {
  const handle = screen.getByRole("button", { name: `拖曳調整順序：${name}` });
  handle.focus();
  fireEvent.keyDown(handle, { code: "Space", key: " " });
  await waitFor(() => expect(screen.getByTestId("place-drag-overlay")).toBeInTheDocument());
  await new Promise((resolve) => setTimeout(resolve, 0));
  for (let step = 0; step < steps; step += 1) fireEvent.keyDown(document, { code: key, key });
  fireEvent.keyDown(document, { code: "Space", key: " " });
}

describe("拖曳調整地點順序", () => {
  it("shows a drag handle for every place", async () => {
    await setupDay();
    expect(screen.getAllByRole("button", { name: /^拖曳調整順序：/ })).toHaveLength(3);
  });

  it("hides the handle when the day has a single place", async () => {
    const context = await setupItinerary();
    await context.addPlace(1, "岡山城", "11:30");
    render(<DayItineraryPage onBack={vi.fn()} repository={context.itineraryRepository} trip={context.trip} />);
    expect(await screen.findByText("岡山城")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^拖曳調整順序：/ })).not.toBeInTheDocument();
  });

  it("moves a place to the top, changes only its arrival time and tells the user", async () => {
    const { itineraryRepository, trip } = await setupDay();

    await dragWithKeyboard("倉敷美觀地區", 2, "ArrowUp");

    await waitFor(async () => expect(await timelineNames()).toEqual(["倉敷美觀地區", "岡山後樂園", "岡山城"]));
    expect(
      await screen.findByText("已將「倉敷美觀地區」的抵達時間改為 08:30，可再按編輯修改。"),
    ).toHaveAttribute("role", "status");
    const places = await itineraryRepository.listPlacesForDay(trip.id, 1);
    expect(places.map((place) => place.arrivalTime)).toEqual(["08:30", "09:00", "11:30"]);
  });

  it("uses the midpoint when dropped between two places and resets changed segments", async () => {
    await setupDay();

    await dragWithKeyboard("岡山後樂園", 1, "ArrowDown");

    await waitFor(async () => expect(await timelineNames()).toEqual(["岡山城", "岡山後樂園", "倉敷美觀地區"]));
    expect(await screen.findByText("12:45")).toBeInTheDocument();
    expect(await screen.findByRole("combobox", { name: "交通方式：岡山城 → 岡山後樂園" })).toHaveDisplayValue("未設定");
    expect(screen.getByRole("combobox", { name: "交通方式：岡山後樂園 → 倉敷美觀地區" })).toHaveDisplayValue("未設定");
  });
});
