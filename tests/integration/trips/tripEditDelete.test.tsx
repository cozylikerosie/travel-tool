import { IDBFactory } from "fake-indexeddb";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { App } from "../../../src/app/App";
import { createTripDatabase } from "../../../src/data/database";
import { createTripRepository } from "../../../src/data/tripRepository";
import type { Trip } from "../../../src/features/trips/tripSchema";

const trip: Trip = {
  id: "3d8dfb88-6a9f-4ef6-8cc5-7084fa8cab2f",
  createdAt: "2026-10-16T01:02:03.000Z",
  updatedAt: "2026-10-16T01:02:03.000Z",
  name: "四國原始旅程",
  destinations: ["岡山", "香川"],
  startDate: "2026-12-20",
  endDate: "2026-12-22",
  budgetAmountMinor: 6_000_000,
  budgetCurrency: "TWD",
  companions: ["小明"],
  notes: "原始備註",
};

const databases: ReturnType<typeof createTripDatabase>[] = [];

afterEach(async () => {
  vi.restoreAllMocks();
  const activeDatabases = databases.splice(0);
  for (const database of activeDatabases) database.close();
  await activeDatabases.at(-1)?.delete();
});

function createRepository() {
  const database = createTripDatabase(
    `trip-edit-${crypto.randomUUID()}`,
    new IDBFactory(),
  );
  databases.push(database);
  return createTripRepository(database);
}

async function openTrip(user: ReturnType<typeof userEvent.setup>) {
  await user.click(await screen.findByRole("button", { name: `查看旅程：${trip.name}` }));
}

describe("trip edit and delete", () => {
  it("saves edits and updates the existing trip summary", async () => {
    const user = userEvent.setup();
    const repository = createRepository();
    await repository.create(trip);
    render(<App repository={repository} />);

    await openTrip(user);
    await user.click(screen.getByRole("button", { name: "編輯旅程" }));
    const nameInput = screen.getByLabelText("旅程名稱");
    await user.clear(nameInput);
    await user.type(nameInput, "岡山香川之旅");
    await user.click(screen.getByRole("button", { name: "儲存修改" }));

    expect(await screen.findByRole("heading", { name: "岡山香川之旅" })).toBeInTheDocument();
    await expect(repository.getById(trip.id)).resolves.toMatchObject({
      id: trip.id,
      createdAt: trip.createdAt,
      name: "岡山香川之旅",
    });
  });

  it("saves reordered destinations and shows the saved order in details and the list", async () => {
    const user = userEvent.setup();
    const repository = createRepository();
    await repository.create({ ...trip, destinations: ["岡山", "香川", "愛媛"] });
    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(function (this: HTMLElement) {
      const index = this.getAttribute("data-sort-index");
      return new DOMRect(0, index === null ? 0 : Number(index) * 72, 360, 68);
    });
    render(<App repository={repository} />);

    await openTrip(user);
    await user.click(screen.getByRole("button", { name: "編輯旅程" }));
    const handle = screen.getByRole("button", { name: "拖曳排序目的地：愛媛" });
    handle.focus();
    fireEvent.keyDown(handle, { code: "Space", key: " " });
    await screen.findByTestId("sortable-overlay");
    await new Promise((resolve) => setTimeout(resolve, 0));
    fireEvent.keyDown(document, { code: "ArrowUp", key: "ArrowUp" });
    fireEvent.keyDown(document, { code: "ArrowUp", key: "ArrowUp" });
    fireEvent.keyDown(document, { code: "Space", key: " " });
    expect(screen.getByLabelText("目的地 1")).toHaveValue("愛媛");
    await user.click(screen.getByRole("button", { name: "儲存修改" }));

    expect(await screen.findByText("愛媛・岡山・香川")).toBeInTheDocument();
    await expect(repository.getById(trip.id)).resolves.toMatchObject({
      destinations: ["愛媛", "岡山", "香川"],
    });
    await user.click(screen.getByRole("button", { name: "返回旅程列表" }));
    const listItem = await screen.findByRole("button", { name: `查看旅程：${trip.name}` });
    expect(within(listItem.closest("li") ?? document.body).getByText("愛媛・岡山・香川")).toBeInTheDocument();
  });

  it("discards an unsaved destination order when editing is cancelled", async () => {
    const user = userEvent.setup();
    const repository = createRepository();
    await repository.create(trip);
    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(function (this: HTMLElement) {
      const index = this.getAttribute("data-sort-index");
      return new DOMRect(0, index === null ? 0 : Number(index) * 72, 360, 68);
    });
    render(<App repository={repository} />);

    await openTrip(user);
    await user.click(screen.getByRole("button", { name: "編輯旅程" }));
    const handle = screen.getByRole("button", { name: "拖曳排序目的地：岡山" });
    handle.focus();
    fireEvent.keyDown(handle, { code: "Space", key: " " });
    await screen.findByTestId("sortable-overlay");
    await new Promise((resolve) => setTimeout(resolve, 0));
    fireEvent.keyDown(document, { code: "ArrowDown", key: "ArrowDown" });
    fireEvent.keyDown(document, { code: "Space", key: " " });
    expect(screen.getByLabelText("目的地 1")).toHaveValue("香川");
    await user.click(screen.getByRole("button", { name: "取消" }));

    expect(await screen.findByText("岡山・香川")).toBeInTheDocument();
    await expect(repository.getById(trip.id)).resolves.toEqual(trip);
  });

  it("keeps a trip when deletion is cancelled and removes it after confirmation", async () => {
    const user = userEvent.setup();
    const repository = createRepository();
    await repository.create(trip);
    render(<App repository={repository} />);

    await openTrip(user);
    await user.click(screen.getByRole("button", { name: "刪除旅程" }));
    expect(screen.getByRole("dialog", { name: "刪除旅程" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "取消" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    await expect(repository.getById(trip.id)).resolves.toEqual(trip);

    await user.click(screen.getByRole("button", { name: "刪除旅程" }));
    await user.click(screen.getByRole("button", { name: "確認刪除" }));
    expect(await screen.findByRole("heading", { name: "還沒有旅程" })).toBeInTheDocument();
    await expect(repository.getById(trip.id)).resolves.toBeUndefined();
  });
});