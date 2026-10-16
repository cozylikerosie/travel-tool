import { IDBFactory } from "fake-indexeddb";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";
import { App } from "../../../src/app/App";
import { createTripDatabase } from "../../../src/data/database";
import { createTripRepository } from "../../../src/data/tripRepository";
import type { Trip } from "../../../src/features/trips/tripSchema";

const sourceTrip: Trip = {
  id: "3d8dfb88-6a9f-4ef6-8cc5-7084fa8cab2f",
  createdAt: "2026-10-16T01:02:03.000Z",
  updatedAt: "2026-10-16T01:02:03.000Z",
  name: "四國原始旅程",
  destinations: ["岡山", "香川"],
  startDate: "2026-12-20",
  endDate: "2026-12-22",
  budgetAmountMinor: 6_000_025,
  budgetCurrency: "TWD",
  companions: ["小明"],
  notes: "原始備註",
};

const databases: ReturnType<typeof createTripDatabase>[] = [];

afterEach(async () => {
  const activeDatabases = databases.splice(0);
  for (const database of activeDatabases) database.close();
  await activeDatabases.at(-1)?.delete();
});

describe("trip copy", () => {
  it("creates an editable independent trip draft without changing its source", async () => {
    const user = userEvent.setup();
    const database = createTripDatabase(
      `trip-copy-${crypto.randomUUID()}`,
      new IDBFactory(),
    );
    databases.push(database);
    const repository = createTripRepository(database);
    await repository.create(sourceTrip);
    render(<App repository={repository} />);

    await user.click(await screen.findByRole("button", { name: `查看旅程：${sourceTrip.name}` }));
    await user.click(screen.getByRole("button", { name: "複製旅程" }));

    expect(screen.getByLabelText("旅程名稱")).toHaveValue(sourceTrip.name);
    expect(screen.getByLabelText("總預算")).toHaveValue("60000.25");
    expect(screen.getByLabelText("目的地 1")).toHaveValue("岡山");
    expect(screen.getByLabelText("目的地 2")).toHaveValue("香川");

    const nameInput = screen.getByLabelText("旅程名稱");
    await user.clear(nameInput);
    await user.type(nameInput, "複製後的新旅程");
    await user.click(screen.getByRole("button", { name: "建立旅程" }));

    expect(await screen.findByRole("heading", { name: "複製後的新旅程" })).toBeInTheDocument();
    const trips = await repository.listAll();
    expect(trips).toHaveLength(2);
    const copy = trips.find((item) => item.name === "複製後的新旅程");
    expect(copy).toBeDefined();
    expect(copy?.id).not.toBe(sourceTrip.id);
    await expect(repository.getById(sourceTrip.id)).resolves.toEqual(sourceTrip);

    await user.click(screen.getByRole("button", { name: `查看旅程：${copy!.name}` }));
    await user.click(screen.getByRole("button", { name: "刪除旅程" }));
    await user.click(screen.getByRole("button", { name: "確認刪除" }));
    await expect(repository.getById(sourceTrip.id)).resolves.toEqual(sourceTrip);
  });
});