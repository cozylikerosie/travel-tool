import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DayItineraryPage } from "../../../src/features/itinerary/DayItineraryPage";
import {
  CASTLE,
  KORAKUEN,
  KURASHIKI,
  cleanupDatabases,
  selectDay,
  setTime,
  setupItinerary,
  timelineNames,
} from "./helpers";

vi.mock("react-leaflet", () => import("../../mocks/reactLeaflet"));

afterEach(cleanupDatabases);

async function setupDay() {
  const context = await setupItinerary();
  const korakuen = await context.addPlace(1, "岡山後樂園", "09:00", { coordinates: KORAKUEN });
  const castle = await context.addPlace(1, "岡山城", "11:30", { coordinates: CASTLE });
  const kurashiki = await context.addPlace(1, "倉敷美觀地區", "14:00");
  render(<DayItineraryPage onBack={vi.fn()} repository={context.itineraryRepository} trip={context.trip} />);
  await screen.findByRole("list", { name: /的地點$/ });
  return { ...context, korakuen, castle, kurashiki };
}

const markerLabels = () => screen.queryAllByTestId("map-marker").map((marker) => marker.getAttribute("aria-label"));

describe("US4 編輯、刪除與移動地點", () => {
  it("edits every field and reflects the change in the timeline and the map", async () => {
    const user = userEvent.setup();
    const { itineraryRepository, trip, castle } = await setupDay();

    await user.click(screen.getByRole("button", { name: "編輯：岡山城" }));
    const form = await screen.findByRole("form", { name: "編輯地點" });
    expect(within(form).getByLabelText("地點名稱")).toHaveValue("岡山城");
    expect(within(form).getByLabelText("座標或 Google 地圖網址")).toHaveValue("34.665, 133.936");
    expect(within(form).getByLabelText("抵達時間")).toHaveValue("11:30");

    await user.clear(within(form).getByLabelText("地點名稱"));
    await user.type(within(form).getByLabelText("地點名稱"), "岡山城天守閣");
    await user.type(within(form).getByLabelText("地址"), "岡山市北区丸の内2-3-1");
    await user.clear(within(form).getByLabelText("座標或 Google 地圖網址"));
    await user.type(within(form).getByLabelText("座標或 Google 地圖網址"), "34.6651, 133.9361");
    setTime("抵達時間", "12:00");
    await user.click(within(form).getByRole("radio", { name: "填離開時間" }));
    setTime("離開時間", "13:15");
    await user.type(within(form).getByLabelText("備註"), "天守閣內有展示");
    await user.click(within(form).getByRole("button", { name: "儲存變更" }));

    await waitFor(async () => expect(await timelineNames()).toEqual(["岡山後樂園", "岡山城天守閣", "倉敷美觀地區"]));
    expect(screen.getByText("岡山市北区丸の内2-3-1")).toBeInTheDocument();
    expect(screen.getByText("13:15 離開")).toBeInTheDocument();
    expect(screen.getByText("天守閣內有展示")).toBeInTheDocument();
    await waitFor(() => expect(markerLabels()).toContain("地圖標記 2：岡山城天守閣"));

    const saved = (await itineraryRepository.listPlacesForDay(trip.id, 1)).find((place) => place.id === castle.id);
    expect(saved).toMatchObject({
      coordinates: { lat: 34.6651, lng: 133.9361 },
      arrivalTime: "12:00",
      stay: { kind: "departure", time: "13:15" },
    });
  });

  it("opens editing in a dialog with focus inside, and closes with Escape", async () => {
    const user = userEvent.setup();
    await setupDay();

    const editButton = screen.getByRole("button", { name: "編輯：倉敷美觀地區" });
    await user.click(editButton);
    const dialog = await screen.findByRole("dialog", { name: "編輯地點" });
    expect(within(dialog).getByRole("form", { name: "編輯地點" })).toBeInTheDocument();
    expect(dialog).toContainElement(document.activeElement as HTMLElement);
    expect(within(dialog).getByLabelText("地點名稱")).toHaveFocus();

    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(editButton).toHaveFocus();
  });

  it("opens adding in a dialog and closes with the cancel button", async () => {
    const user = userEvent.setup();
    await setupDay();

    await user.click(screen.getByRole("button", { name: "新增地點" }));
    const dialog = await screen.findByRole("dialog", { name: "新增地點" });
    expect(within(dialog).getByLabelText("座標或 Google 地圖網址")).toHaveFocus();

    await user.click(within(dialog).getByRole("button", { name: "取消" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("puts a manual place on the map once coordinates are added", async () => {
    const user = userEvent.setup();
    await setupDay();
    await waitFor(() => expect(markerLabels()).toHaveLength(2));

    await user.click(screen.getByRole("button", { name: "編輯：倉敷美觀地區" }));
    const form = await screen.findByRole("form", { name: "編輯地點" });
    await user.click(within(form).getByRole("radio", { name: "貼上座標或網址" }));
    await user.type(within(form).getByLabelText("座標或 Google 地圖網址"), `${KURASHIKI.lat}, ${KURASHIKI.lng}`);
    await user.click(within(form).getByRole("button", { name: "儲存變更" }));

    await waitFor(() => expect(markerLabels()).toContain("地圖標記 3：倉敷美觀地區"));
    expect(screen.queryByText("未標於地圖")).not.toBeInTheDocument();
  });

  it("removes coordinates from a place", async () => {
    const user = userEvent.setup();
    await setupDay();

    await user.click(screen.getByRole("button", { name: "編輯：岡山城" }));
    const form = await screen.findByRole("form", { name: "編輯地點" });
    await user.click(within(form).getByRole("button", { name: "移除座標" }));
    await user.click(within(form).getByRole("button", { name: "儲存變更" }));

    await waitFor(() => expect(markerLabels()).toEqual(["地圖標記 1：岡山後樂園"]));
  });

  it("blocks a departure time earlier than arrival", async () => {
    const user = userEvent.setup();
    const { itineraryRepository, trip } = await setupDay();

    await user.click(screen.getByRole("button", { name: "編輯：岡山城" }));
    const form = await screen.findByRole("form", { name: "編輯地點" });
    await user.click(within(form).getByRole("radio", { name: "填離開時間" }));
    setTime("離開時間", "10:00");
    await user.click(within(form).getByRole("button", { name: "儲存變更" }));

    expect(await within(form).findByText("離開時間不可早於抵達時間")).toBeInTheDocument();
    const places = await itineraryRepository.listPlacesForDay(trip.id, 1);
    expect(places.find((place) => place.name === "岡山城")?.stay).toEqual({ kind: "none" });
  });

  it("asks before deleting and leaves the new gap unset", async () => {
    const user = userEvent.setup();
    const { korakuen, castle, kurashiki, setMode } = await setupDay();
    await setMode(1, korakuen.id, castle.id, "walk");
    await setMode(1, castle.id, kurashiki.id, "rail");

    await user.click(screen.getByRole("button", { name: "刪除：岡山城" }));
    let dialog = screen.getByRole("dialog", { name: "刪除地點" });
    expect(dialog).toHaveTextContent("岡山城");
    await user.click(within(dialog).getByRole("button", { name: "取消" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(await timelineNames()).toEqual(["岡山後樂園", "岡山城", "倉敷美觀地區"]);

    await user.click(screen.getByRole("button", { name: "刪除：岡山城" }));
    dialog = screen.getByRole("dialog", { name: "刪除地點" });
    await user.click(within(dialog).getByRole("button", { name: "刪除地點" }));

    await waitFor(async () => expect(await timelineNames()).toEqual(["岡山後樂園", "倉敷美觀地區"]));
    expect(screen.getByRole("combobox", { name: "交通方式：岡山後樂園 → 倉敷美觀地區" })).toHaveDisplayValue("未設定");
  });

  it("moves a place to Day 3 and resets only the changed segments", async () => {
    const user = userEvent.setup();
    const { korakuen, castle, kurashiki, addPlace, setMode } = await setupDay();
    const naoshima = await addPlace(3, "直島", "10:00");
    const port = await addPlace(3, "宮浦港", "16:00");
    await setMode(1, korakuen.id, castle.id, "walk");
    await setMode(1, castle.id, kurashiki.id, "rail");
    await setMode(3, naoshima.id, port.id, "ferry");

    await user.click(screen.getByRole("button", { name: "移到其他天：倉敷美觀地區" }));
    const dialog = screen.getByRole("dialog", { name: "移到其他天" });
    const select = within(dialog).getByLabelText("目標日");
    expect(within(select).queryByRole("option", { name: "Day 1・12.10 THU" })).not.toBeInTheDocument();
    await user.selectOptions(select, "Day 3・12.12 SAT");
    await user.click(within(dialog).getByRole("button", { name: "移動" }));

    await waitFor(async () => expect(await timelineNames()).toEqual(["岡山後樂園", "岡山城"]));
    expect(screen.getByRole("combobox", { name: "交通方式：岡山後樂園 → 岡山城" })).toHaveDisplayValue("步行");

    await selectDay(user, "Day 3・12.12 SAT");
    await waitFor(async () => expect(await timelineNames()).toEqual(["直島", "倉敷美觀地區", "宮浦港"]));
    expect(screen.getByRole("combobox", { name: "交通方式：直島 → 倉敷美觀地區" })).toHaveDisplayValue("未設定");
    expect(screen.getByRole("combobox", { name: "交通方式：倉敷美觀地區 → 宮浦港" })).toHaveDisplayValue("未設定");
  });
});
