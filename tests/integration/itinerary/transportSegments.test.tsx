import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DayItineraryPage } from "../../../src/features/itinerary/DayItineraryPage";
import { CASTLE, KORAKUEN, cleanupDatabases, setupItinerary } from "./helpers";

vi.mock("react-leaflet", () => import("../../mocks/reactLeaflet"));

afterEach(cleanupDatabases);

async function setupDay() {
  const context = await setupItinerary();
  const korakuen = await context.addPlace(1, "岡山後樂園", "09:00", { coordinates: KORAKUEN });
  const castle = await context.addPlace(1, "岡山城", "11:30", { coordinates: CASTLE });
  const kurashiki = await context.addPlace(1, "倉敷美觀地區", "14:00", { address: "倉敷市本町" });
  return { ...context, korakuen, castle, kurashiki };
}

function renderPage(context: Awaited<ReturnType<typeof setupItinerary>>) {
  return render(
    <DayItineraryPage onBack={vi.fn()} repository={context.itineraryRepository} trip={context.trip} />,
  );
}

const firstLeg = "岡山後樂園 → 岡山城";
const secondLeg = "岡山城 → 倉敷美觀地區";

describe("US2 設定交通方式並以 Google 地圖查詢", () => {
  it("shows one segment per adjacent pair, unset by default", async () => {
    const context = await setupDay();
    renderPage(context);

    expect(await screen.findByRole("combobox", { name: `交通方式：${firstLeg}` })).toHaveDisplayValue("未設定");
    expect(screen.getByRole("combobox", { name: `交通方式：${secondLeg}` })).toHaveDisplayValue("未設定");
    expect(screen.getAllByRole("combobox", { name: /^交通方式：/ })).toHaveLength(2);
  });

  it("shows no segment when the day has a single place", async () => {
    const context = await setupItinerary();
    await context.addPlace(1, "岡山後樂園", "09:00");
    renderPage(context);

    expect(await screen.findByText("岡山後樂園")).toBeInTheDocument();
    expect(screen.queryByRole("combobox", { name: /^交通方式：/ })).not.toBeInTheDocument();
  });

  it("saves each of the eight modes and keeps it after re-opening", async () => {
    const user = userEvent.setup();
    const context = await setupDay();
    const view = renderPage(context);
    const select = await screen.findByRole("combobox", { name: `交通方式：${firstLeg}` });

    const options = Array.from((select as HTMLSelectElement).options).map((option) => option.text);
    expect(options).toEqual(["未設定", "JR／電車", "巴士", "渡輪", "計程車", "步行", "自駕", "飛機", "其他"]);

    for (const label of options.slice(1)) {
      await user.selectOptions(select, label);
      await waitFor(() => expect(select).toHaveDisplayValue(label));
    }
    await user.selectOptions(select, "JR／電車");
    await waitFor(async () => expect((await context.segments(1))[0]?.mode).toBe("rail"));

    view.unmount();
    renderPage(context);
    expect(await screen.findByRole("combobox", { name: `交通方式：${firstLeg}` })).toHaveDisplayValue("JR／電車");
  });

  it("links to Google Maps directions with the matching travel mode in a new tab", async () => {
    const user = userEvent.setup();
    const context = await setupDay();
    renderPage(context);

    const select = await screen.findByRole("combobox", { name: `交通方式：${firstLeg}` });
    const link = () => screen.getByRole("link", { name: `在 Google 地圖開啟：${firstLeg}` });
    expect(link()).toHaveAttribute("target", "_blank");
    expect(link()).toHaveAttribute("rel", "noopener noreferrer");

    const expectations: [string, string | null][] = [
      ["JR／電車", "transit"],
      ["巴士", "transit"],
      ["渡輪", "transit"],
      ["步行", "walking"],
      ["計程車", "driving"],
      ["自駕", "driving"],
      ["飛機", null],
      ["其他", null],
      ["未設定", null],
    ];
    for (const [label, travelmode] of expectations) {
      await user.selectOptions(select, label);
      await waitFor(() => {
        const search = new URL(link().getAttribute("href")!).searchParams;
        expect(search.get("travelmode")).toBe(travelmode);
        expect(search.get("origin")).toBe("34.6672,133.9354");
        expect(search.get("destination")).toBe("34.665,133.936");
      });
    }
  });

  it("uses the name and address for an endpoint without coordinates", async () => {
    const context = await setupDay();
    renderPage(context);

    const link = await screen.findByRole("link", { name: `在 Google 地圖開啟：${secondLeg}` });
    const search = new URL(link.getAttribute("href")!).searchParams;
    expect(search.get("origin")).toBe("34.665,133.936");
    expect(search.get("destination")).toBe("倉敷美觀地區, 倉敷市本町");
  });

  it("hides the link when an endpoint has neither coordinates nor a name", async () => {
    const context = await setupItinerary();
    await context.addPlace(1, "岡山後樂園", "09:00", { coordinates: KORAKUEN });
    const unnamed = await context.addPlace(1, "", "10:00", { coordinates: CASTLE });
    await context.database.places.update(unnamed.id, { coordinates: null });
    renderPage(context);

    expect(await screen.findByRole("combobox", { name: /^交通方式：/ })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /^在 Google 地圖開啟/ })).not.toBeInTheDocument();
  });

  it("keeps unchanged segments and resets changed ones after reordering", async () => {
    const context = await setupDay();
    const late = await context.addPlace(1, "岡山駅", "16:00");
    await context.setMode(1, context.korakuen.id, context.castle.id, "walk");
    await context.setMode(1, context.castle.id, context.kurashiki.id, "rail");
    await context.setMode(1, context.kurashiki.id, late.id, "bus");

    // 岡山城改為 08:30：順序變為 岡山城、後樂園、倉敷、岡山駅
    await context.itineraryRepository.updatePlace(context.castle.id, {
      name: "岡山城",
      address: "",
      coordinates: CASTLE,
      arrivalTime: "08:30",
      stay: { kind: "none" },
      notes: "",
    });
    renderPage(context);

    expect(await screen.findByRole("combobox", { name: "交通方式：岡山城 → 岡山後樂園" })).toHaveDisplayValue("未設定");
    expect(screen.getByRole("combobox", { name: "交通方式：岡山後樂園 → 倉敷美觀地區" })).toHaveDisplayValue("未設定");
    expect(screen.getByRole("combobox", { name: "交通方式：倉敷美觀地區 → 岡山駅" })).toHaveDisplayValue("巴士");
  });
});
