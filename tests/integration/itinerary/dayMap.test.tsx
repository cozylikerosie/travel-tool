import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DayItineraryPage } from "../../../src/features/itinerary/DayItineraryPage";
import { ASIA_DEFAULT_BOUNDS } from "../../../src/features/itinerary/mapModel";
import { mockMap, resetMockMap } from "../../mocks/reactLeaflet";
import { CASTLE, KORAKUEN, KURASHIKI, cleanupDatabases, selectDay, setupItinerary } from "./helpers";

vi.mock("react-leaflet", () => import("../../mocks/reactLeaflet"));

beforeEach(resetMockMap);
afterEach(cleanupDatabases);

type Context = Awaited<ReturnType<typeof setupItinerary>>;

function renderPage(context: Context) {
  return render(
    <DayItineraryPage onBack={vi.fn()} repository={context.itineraryRepository} trip={context.trip} />,
  );
}

async function setupDay() {
  const context = await setupItinerary();
  const korakuen = await context.addPlace(1, "岡山後樂園", "09:00", { coordinates: KORAKUEN });
  const castle = await context.addPlace(1, "岡山城", "11:30", { coordinates: CASTLE });
  const kurashiki = await context.addPlace(1, "倉敷美觀地區", "14:00", { coordinates: KURASHIKI });
  return { ...context, korakuen, castle, kurashiki };
}

const markers = () => screen.queryAllByTestId("map-marker");
const markerOrders = () => markers().map((marker) => marker.getAttribute("data-order"));
const lines = () => screen.queryAllByTestId("map-line");
const listItem = (name: string) => screen.getByRole("button", { name: `選取地點：${name}` }).closest("li")!;

describe("US3 在地圖上總覽當天路線", () => {
  it("shows numbered markers joined in order", async () => {
    const context = await setupDay();
    renderPage(context);

    await waitFor(() => expect(markerOrders()).toEqual(["1", "2", "3"]));
    expect(lines()).toHaveLength(2);
    expect(JSON.parse(lines()[0]!.getAttribute("data-positions")!)).toEqual([
      [KORAKUEN.lat, KORAKUEN.lng],
      [CASTLE.lat, CASTLE.lng],
    ]);
  });

  it("styles lines by transport mode and explains every style in a legend", async () => {
    const context = await setupDay();
    await context.setMode(1, context.korakuen.id, context.castle.id, "walk");
    await context.setMode(1, context.castle.id, context.kurashiki.id, "rail");
    renderPage(context);

    await waitFor(() => expect(lines().map((line) => line.getAttribute("data-mode"))).toEqual(["walk", "rail"]));
    expect(lines()[0]!.className).not.toBe(lines()[1]!.className);

    const legend = screen.getByRole("list", { name: "交通方式圖例" });
    expect(within(legend).getAllByRole("listitem").map((item) => item.textContent)).toEqual([
      "JR／電車",
      "巴士",
      "渡輪",
      "計程車",
      "步行",
      "自駕",
      "飛機",
      "其他",
      "未設定",
    ]);
  });

  it("leaves manual places off the map while keeping numbers aligned with the timeline", async () => {
    const context = await setupDay();
    await context.addPlace(1, "倉敷駅", "13:00");
    renderPage(context);

    await waitFor(() => expect(markerOrders()).toEqual(["1", "2", "4"]));
    expect(lines()).toHaveLength(1);
  });

  it("highlights the timeline item when a marker is clicked", async () => {
    const user = userEvent.setup();
    const context = await setupDay();
    renderPage(context);

    await waitFor(() => expect(markers()).toHaveLength(3));
    await user.click(markers()[1]!);

    expect(listItem("岡山城")).toHaveAttribute("aria-current", "true");
    expect(Element.prototype.scrollIntoView).toHaveBeenCalledWith({ block: "nearest" });
    expect(markers()[1]).toHaveAttribute("data-selected", "true");
  });

  it("highlights and pans to the marker when a timeline item is clicked", async () => {
    const user = userEvent.setup();
    const context = await setupDay();
    renderPage(context);

    await user.click(await screen.findByRole("button", { name: "選取地點：倉敷美觀地區" }));

    expect(markers()[2]).toHaveAttribute("data-selected", "true");
    expect(listItem("倉敷美觀地區")).toHaveAttribute("aria-current", "true");
    expect(mockMap.panTo).toHaveBeenCalledWith([KURASHIKI.lat, KURASHIKI.lng]);
    expect(Element.prototype.scrollIntoView).not.toHaveBeenCalled();
  });

  it("does not pan when the selected marker is already visible", async () => {
    const user = userEvent.setup();
    mockMap.getBounds.mockImplementation(() => ({ contains: () => true }));
    const context = await setupDay();
    renderPage(context);

    await user.click(await screen.findByRole("button", { name: "選取地點：岡山城" }));
    expect(mockMap.panTo).not.toHaveBeenCalled();
  });

  it("only highlights the timeline for a manual place", async () => {
    const user = userEvent.setup();
    const context = await setupDay();
    await context.addPlace(1, "倉敷駅", "13:00");
    renderPage(context);

    await user.click(await screen.findByRole("button", { name: "選取地點：倉敷駅" }));
    expect(listItem("倉敷駅")).toHaveAttribute("aria-current", "true");
    expect(markers().every((marker) => marker.getAttribute("data-selected") === "false")).toBe(true);
    expect(mockMap.panTo).not.toHaveBeenCalled();
  });

  it("updates numbering and line order after an arrival time changes", async () => {
    const context = await setupDay();
    await context.itineraryRepository.updatePlace(context.kurashiki.id, {
      name: "倉敷美觀地區",
      address: "",
      coordinates: KURASHIKI,
      arrivalTime: "08:00",
      stay: { kind: "none" },
      notes: "",
    });
    renderPage(context);

    await waitFor(() =>
      expect(markers().map((marker) => marker.getAttribute("aria-label"))).toEqual([
        "地圖標記 1：倉敷美觀地區",
        "地圖標記 2：岡山後樂園",
        "地圖標記 3：岡山城",
      ]),
    );
    expect(JSON.parse(lines()[0]!.getAttribute("data-positions")!)[0]).toEqual([KURASHIKI.lat, KURASHIKI.lng]);
  });

  it("fits the whole trip on a day without coordinates", async () => {
    const user = userEvent.setup();
    const context = await setupItinerary();
    await context.addPlace(1, "岡山後樂園", "09:00", { coordinates: KORAKUEN });
    await context.addPlace(1, "岡山城", "11:30", { coordinates: CASTLE });
    await context.addPlace(2, "倉敷美觀地區", "14:00", { coordinates: KURASHIKI });
    renderPage(context);
    await waitFor(() => expect(markers()).toHaveLength(2));
    mockMap.fitBounds.mockClear();

    await selectDay(user, "Day 5・12.14 MON");

    await waitFor(() =>
      expect(mockMap.fitBounds).toHaveBeenCalledWith(
        [
          [KURASHIKI.lat, KURASHIKI.lng],
          [KORAKUEN.lat, CASTLE.lng],
        ],
        expect.anything(),
      ),
    );
    expect(markers()).toHaveLength(0);
  });

  it("shows Asia when the whole trip has no coordinates", async () => {
    const context = await setupItinerary();
    renderPage(context);

    await waitFor(() => expect(mockMap.fitBounds).toHaveBeenCalledWith(ASIA_DEFAULT_BOUNDS, expect.anything()));
  });

  it("keeps the timeline usable when map tiles fail to load", async () => {
    const user = userEvent.setup();
    const context = await setupDay();
    renderPage(context);

    await user.click((await screen.findAllByRole("button", { name: "觸發圖磚錯誤" }))[0]!);

    expect(screen.getByText("地圖暫時無法載入")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "在 Google 地圖開啟：岡山後樂園 → 岡山城" })).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "交通方式：岡山後樂園 → 岡山城" })).toBeEnabled();
  });

  it("uses keyless Esri gray tiles with labels, attribution, and follows the site theme", async () => {
    const context = await setupItinerary();
    const view = renderPage(context);
    const tileUrls = async () =>
      (await screen.findAllByTestId("tile-layer")).map((layer) => layer.getAttribute("data-url"));
    expect(await tileUrls()).toEqual([
      "https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}",
      "https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Reference/MapServer/tile/{z}/{y}/{x}",
    ]);
    expect(screen.getAllByTestId("tile-layer")[0]!.getAttribute("data-attribution")!.replace(/<[^>]*>/g, "")).toBe(
      "Tiles © Esri — Esri, HERE, Garmin, © OpenStreetMap contributors, and the GIS user community",
    );
    view.unmount();

    vi.mocked(window.matchMedia).mockImplementation(
      (query: string) =>
        ({
          matches: query === "(prefers-color-scheme: dark)",
          media: query,
          addEventListener: vi.fn(),
          removeEventListener: vi.fn(),
        }) as unknown as MediaQueryList,
    );
    const darkView = renderPage(context);
    expect((await tileUrls()).every((url) => url?.includes("/World_Dark_Gray_"))).toBe(true);
    darkView.unmount();

    document.documentElement.setAttribute("data-theme", "light");
    renderPage(context);
    expect((await tileUrls()).every((url) => url?.includes("/World_Light_Gray_"))).toBe(true);
  });

  it("stacks into one column on narrow screens with the timeline first", async () => {
    const context = await setupItinerary();
    renderPage(context);

    const layout = await screen.findByTestId("itinerary-layout");
    expect(layout).toHaveClass("grid-cols-1", "lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]");
    const timeline = screen.getByRole("region", { name: "當天時間軸" });
    const map = screen.getByRole("region", { name: "當天地圖" });
    expect(timeline.compareDocumentPosition(map) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(map).toHaveClass("h-[420px]", "lg:sticky", "lg:h-screen");
  });
});
