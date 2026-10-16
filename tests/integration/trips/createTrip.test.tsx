import { IDBFactory } from "fake-indexeddb";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createTripDatabase } from "../../../src/data/database";
import { createTripRepository, type TripRepository } from "../../../src/data/tripRepository";
import { App } from "../../../src/app/App";
import { TripForm } from "../../../src/features/trips/TripForm";
import { saveTrip } from "../../../src/features/trips/saveTrip";
import type { Trip } from "../../../src/features/trips/tripSchema";

const validTrip: Trip = {
  id: "3d8dfb88-6a9f-4ef6-8cc5-7084fa8cab2f",
  createdAt: "2026-10-16T01:02:03.000Z",
  updatedAt: "2026-10-16T01:02:03.000Z",
  name: "岡山之旅",
  destinations: ["岡山"],
  startDate: "2026-12-20",
  endDate: "2026-12-22",
  budgetAmountMinor: 6_000_000,
  budgetCurrency: "TWD",
  companions: ["小明"],
  notes: "備註",
};

const databases: ReturnType<typeof createTripDatabase>[] = [];

afterEach(async () => {
  const activeDatabases = databases.splice(0);
  for (const database of activeDatabases) database.close();
  await activeDatabases.at(-1)?.delete();
});

function makeDatabase() {
  const database = createTripDatabase(
    `trip-create-${crypto.randomUUID()}`,
    new IDBFactory(),
  );
  databases.push(database);
  return database;
}

async function fillValidForm(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText("旅程名稱"), "四國之旅");
  await user.type(screen.getByLabelText("目的地 1"), "岡山");
  await user.type(screen.getByLabelText("出發日期"), "2026-12-20");
  await user.type(screen.getByLabelText("回程日期"), "2026-12-22");
  await user.type(screen.getByLabelText("總預算"), "60000");
  await user.selectOptions(screen.getByLabelText("預算幣別"), "TWD");
  await user.click(screen.getByRole("button", { name: "新增同行者" }));
  await user.type(screen.getByLabelText("同行者 1"), "小明");
  await user.type(screen.getByRole("textbox", { name: "備註" }), "冬季旅行");
}

describe("trip save flow", () => {
  it("shows the newly created trip summary on the home page", async () => {
    const user = userEvent.setup();
    const repository = createTripRepository(makeDatabase());
    render(<App repository={repository} />);

    await user.click(await screen.findByRole("button", { name: "建立第一趟旅程" }));
    await fillValidForm(user);
    await user.click(screen.getByRole("button", { name: "建立旅程" }));

    expect(await screen.findByRole("heading", { name: "四國之旅" })).toBeInTheDocument();
    expect(screen.getByText("岡山")).toBeInTheDocument();
    expect(screen.getByText("3 天")).toBeInTheDocument();
  });

  it("persists a new trip with UUID and creation/update timestamps", async () => {
    const user = userEvent.setup();
    const repository = createTripRepository(makeDatabase());
    const id = "7a12ff7e-478e-4967-a503-86680a4c7f1e";
    const timestamp = new Date("2026-10-16T12:00:00.000Z");
    const onSaved = vi.fn();
    render(
      <TripForm
        onSaved={onSaved}
        save={(input, existingTrip) =>
          saveTrip(input, {
            existingTrip,
            repository,
            createId: () => id,
            now: () => timestamp,
          })
        }
      />,
    );

    await fillValidForm(user);
    await user.click(screen.getByRole("button", { name: "建立旅程" }));
    await waitFor(() => expect(onSaved).toHaveBeenCalled());

    const savedTrip = await repository.getById(id);
    expect(savedTrip).toMatchObject({
      id,
      createdAt: timestamp.toISOString(),
      updatedAt: timestamp.toISOString(),
      name: "四國之旅",
      budgetAmountMinor: 6_000_000,
      budgetCurrency: "TWD",
    });
    expect(onSaved).toHaveBeenCalledWith(savedTrip);
    expect(await screen.findByText("旅程已儲存")).toBeInTheDocument();
  });

  it("preserves id/createdAt and refreshes updatedAt when editing", async () => {
    const user = userEvent.setup();
    const repository = createTripRepository(makeDatabase());
    await repository.create(validTrip);
    const nextTimestamp = new Date("2026-10-17T12:00:00.000Z");
    render(
      <TripForm
        initialTrip={validTrip}
        save={(input, existingTrip) =>
          saveTrip(input, {
            existingTrip,
            repository,
            createId: () => "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
            now: () => nextTimestamp,
          })
        }
      />,
    );

    const nameInput = screen.getByLabelText("旅程名稱");
    await user.clear(nameInput);
    await user.type(nameInput, "岡山與四國之旅");
    await user.click(screen.getByRole("button", { name: "儲存修改" }));

    await expect(repository.getById(validTrip.id)).resolves.toMatchObject({
      id: validTrip.id,
      createdAt: validTrip.createdAt,
      updatedAt: nextTimestamp.toISOString(),
      name: "岡山與四國之旅",
    });
  });

  it.each([
    ["UUID generation", () => { throw new Error("UUID failure"); }, () => new Date("2026-10-16T12:00:00.000Z")],
    ["full schema validation", () => "not-a-uuid", () => new Date("2026-10-16T12:00:00.000Z")],
    ["timestamp generation", () => "7a12ff7e-478e-4967-a503-86680a4c7f1e", () => new Date(Number.NaN)],
  ])("does not write and displays an error when %s fails", async (_failure, createId, now) => {
    const user = userEvent.setup();
    const database = makeDatabase();
    const repository = createTripRepository(database);
    render(
      <TripForm
        save={(input, existingTrip) =>
          saveTrip(input, { existingTrip, repository, createId, now })
        }
      />,
    );

    await fillValidForm(user);
    await user.click(screen.getByRole("button", { name: "建立旅程" }));

    expect(screen.getByRole("alert")).toHaveTextContent("儲存失敗");
    await expect(repository.listAll()).resolves.toEqual([]);
  });

  it("does not persist a partial trip and displays an error when IndexedDB write fails", async () => {
    const user = userEvent.setup();
    const database = makeDatabase();
    const actualRepository = createTripRepository(database);
    const repository: TripRepository = {
      ...actualRepository,
      create: vi.fn(async () => {
        throw new Error("quota exceeded");
      }),
    };
    render(
      <TripForm
        save={(input, existingTrip) =>
          saveTrip(input, {
            existingTrip,
            repository,
            createId: () => "7a12ff7e-478e-4967-a503-86680a4c7f1e",
            now: () => new Date("2026-10-16T12:00:00.000Z"),
          })
        }
      />,
    );

    await fillValidForm(user);
    await user.click(screen.getByRole("button", { name: "建立旅程" }));

    expect(screen.getByRole("alert")).toHaveTextContent("儲存失敗");
    expect(repository.create).toHaveBeenCalledOnce();
    await expect(actualRepository.listAll()).resolves.toEqual([]);
  });
});