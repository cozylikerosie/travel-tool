import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { App } from "../../../src/app/App";
import { DayItineraryPage } from "../../../src/features/itinerary/DayItineraryPage";
import {
  KORAKUEN,
  cleanupDatabases,
  selectDay,
  setTime,
  setupItinerary,
  timelineNames,
} from "./helpers";

vi.mock("react-leaflet", () => import("../../mocks/reactLeaflet"));

afterEach(cleanupDatabases);

async function renderPage() {
  const context = await setupItinerary();
  const onBack = vi.fn();
  render(
    <DayItineraryPage onBack={onBack} repository={context.itineraryRepository} trip={context.trip} />,
  );
  await screen.findByRole("tablist", { name: "旅程日" });
  return { ...context, onBack };
}

async function openForm(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getAllByRole("button", { name: "新增地點" })[0]!);
  return screen.findByRole("form", { name: "新增地點" });
}

describe("US1 安排每天的地點與時間", () => {
  it("lists Day 1・12.10 THU through Day 9・12.18 FRI and switches days", async () => {
    const user = userEvent.setup();
    const { addPlace } = await renderPage();

    const tabs = screen.getAllByRole("tab");
    expect(tabs).toHaveLength(9);
    expect(tabs[0]).toHaveAccessibleName("Day 1・12.10 THU");
    expect(tabs[8]).toHaveAccessibleName("Day 9・12.18 FRI");
    expect(tabs[0]).toHaveAttribute("aria-selected", "true");

    await addPlace(3, "直島", "10:00");
    await selectDay(user, "Day 3・12.12 SAT");
    expect(screen.getByRole("tab", { name: "Day 3・12.12 SAT" })).toHaveAttribute("aria-selected", "true");
    expect(await timelineNames()).toEqual(["直島"]);
  });

  it("saves a place from pasted coordinates", async () => {
    const user = userEvent.setup();
    const { itineraryRepository, trip } = await renderPage();

    const form = await openForm(user);
    await user.type(within(form).getByLabelText("座標或 Google 地圖網址"), "34.6672, 133.9354");
    expect(within(form).getByText("已取得座標：34.6672, 133.9354")).toBeInTheDocument();
    await user.type(within(form).getByLabelText("地點名稱"), "岡山後樂園");
    setTime("抵達時間", "09:00");
    await user.click(within(form).getByRole("button", { name: "儲存地點" }));

    await waitFor(async () => expect(await timelineNames()).toEqual(["岡山後樂園"]));
    const [saved] = await itineraryRepository.listPlacesForDay(trip.id, 1);
    expect(saved).toMatchObject({ name: "岡山後樂園", coordinates: KORAKUEN, arrivalTime: "09:00" });
  });

  it("fills name and coordinates from a desktop Google Maps URL and lets the name be edited", async () => {
    const user = userEvent.setup();
    const { itineraryRepository, trip } = await renderPage();

    const form = await openForm(user);
    await user.click(within(form).getByLabelText("座標或 Google 地圖網址"));
    await user.paste(
      "https://www.google.com/maps/place/%E5%B2%A1%E5%B1%B1%E5%9F%8E/@34.666,133.935,17z/data=!3d34.665!4d133.936",
    );
    const nameInput = within(form).getByLabelText("地點名稱");
    expect(nameInput).toHaveValue("岡山城");
    await user.clear(nameInput);
    await user.type(nameInput, "岡山城（烏城）");
    setTime("抵達時間", "11:30");
    await user.click(within(form).getByRole("button", { name: "儲存地點" }));

    await waitFor(async () => expect(await timelineNames()).toEqual(["岡山城（烏城）"]));
    const [saved] = await itineraryRepository.listPlacesForDay(trip.id, 1);
    expect(saved?.coordinates).toEqual({ lat: 34.665, lng: 133.936 });
  });

  it("explains how to get coordinates when a short link is pasted and never saves bad coordinates", async () => {
    const user = userEvent.setup();
    const { itineraryRepository, trip } = await renderPage();

    const form = await openForm(user);
    await user.click(within(form).getByLabelText("座標或 Google 地圖網址"));
    await user.paste("https://maps.app.goo.gl/xxxx");
    expect(within(form).getByRole("alert")).toHaveTextContent("無法讀取手機分享的短網址");
    expect(within(form).getByRole("alert")).toHaveTextContent("34.6672, 133.9354");

    await user.type(within(form).getByLabelText("地點名稱"), "倉敷");
    setTime("抵達時間", "14:00");
    await user.click(within(form).getByRole("button", { name: "儲存地點" }));

    await waitFor(async () => expect(await timelineNames()).toEqual(["倉敷"]));
    const [saved] = await itineraryRepository.listPlacesForDay(trip.id, 1);
    expect(saved?.coordinates).toBeNull();
  });

  it("saves a manual place with only a name, address and arrival time", async () => {
    const user = userEvent.setup();
    const { itineraryRepository, trip } = await renderPage();

    const form = await openForm(user);
    await user.click(within(form).getByRole("radio", { name: "手動輸入" }));
    expect(within(form).queryByLabelText("座標或 Google 地圖網址")).not.toBeInTheDocument();
    await user.type(within(form).getByLabelText("地點名稱"), "倉敷美觀地區");
    await user.type(within(form).getByLabelText("地址"), "倉敷市本町");
    setTime("抵達時間", "14:00");
    await user.click(within(form).getByRole("button", { name: "儲存地點" }));

    await waitFor(async () => expect(await timelineNames()).toEqual(["倉敷美觀地區"]));
    expect(screen.getByText("未標於地圖")).toBeInTheDocument();
    const [saved] = await itineraryRepository.listPlacesForDay(trip.id, 1);
    expect(saved).toMatchObject({ address: "倉敷市本町", coordinates: null });
  });

  it("requires an arrival time and does not save without it", async () => {
    const user = userEvent.setup();
    const { itineraryRepository, trip } = await renderPage();

    const form = await openForm(user);
    await user.click(within(form).getByRole("radio", { name: "手動輸入" }));
    await user.type(within(form).getByLabelText("地點名稱"), "岡山城");
    await user.click(within(form).getByRole("button", { name: "儲存地點" }));

    expect(await within(form).findByText("請輸入抵達時間")).toBeInTheDocument();
    await expect(itineraryRepository.listPlacesForDay(trip.id, 1)).resolves.toEqual([]);
  });

  it("orders the timeline by arrival time", async () => {
    const user = userEvent.setup();
    const { addPlace } = await renderPage();
    await addPlace(1, "岡山後樂園", "09:00");
    await addPlace(1, "倉敷美觀地區", "14:00");
    await selectDay(user, "Day 2・12.11 FRI");
    await selectDay(user, "Day 1・12.10 THU");

    const form = await openForm(user);
    await user.click(within(form).getByRole("radio", { name: "手動輸入" }));
    await user.type(within(form).getByLabelText("地點名稱"), "岡山城");
    setTime("抵達時間", "11:30");
    await user.click(within(form).getByRole("button", { name: "儲存地點" }));

    await waitFor(async () =>
      expect(await timelineNames()).toEqual(["岡山後樂園", "岡山城", "倉敷美觀地區"]),
    );
  });

  it("shows guidance and an add button on an empty day", async () => {
    await renderPage();
    expect(screen.getByText("這一天還沒有安排地點")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "新增地點" })).toBeInTheDocument();
  });

  it("shows the derived departure time for a stay duration", async () => {
    const user = userEvent.setup();
    await renderPage();

    const form = await openForm(user);
    setTime("抵達時間", "09:00");
    await user.click(within(form).getByRole("radio", { name: "填停留時間" }));
    await user.type(within(form).getByLabelText("停留小時"), "1");
    await user.type(within(form).getByLabelText("停留分鐘"), "30");
    expect(within(form).getByText("預計 10:30 離開")).toBeInTheDocument();

    await user.clear(within(form).getByLabelText("停留小時"));
    await user.type(within(form).getByLabelText("停留小時"), "15");
    expect(within(form).getByText("預計隔天 00:30 離開")).toBeInTheDocument();
  });

  it("opens from the trip details page and returns", async () => {
    const user = userEvent.setup();
    const { tripRepository, itineraryRepository, trip } = await setupItinerary();
    render(<App itineraryRepository={itineraryRepository} repository={tripRepository} />);

    await user.click(await screen.findByRole("button", { name: `查看旅程：${trip.name}` }));
    await user.click(screen.getByRole("button", { name: "每日行程" }));
    expect(await screen.findByRole("tab", { name: "Day 1・12.10 THU" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "返回旅程" }));
    expect(await screen.findByRole("button", { name: "編輯旅程" })).toBeInTheDocument();
  });
});
