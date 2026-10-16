import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { TripForm } from "../../../src/features/trips/TripForm";
import { saveTrip } from "../../../src/features/trips/saveTrip";
import type { TripRepository } from "../../../src/data/tripRepository";

function createRepositoryStub(): TripRepository {
  return {
    create: vi.fn(),
    getById: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    listAll: vi.fn(),
  };
}

describe("trip form validation", () => {
  it("marks required fields in Traditional Chinese and never writes invalid input", async () => {
    const user = userEvent.setup();
    const repository = createRepositoryStub();
    render(
      <TripForm
        save={(input, existingTrip) =>
          saveTrip(input, { existingTrip, repository })
        }
      />,
    );

    await user.click(screen.getByRole("button", { name: "建立旅程" }));

    expect(screen.getByText("請輸入旅程名稱")).toBeInTheDocument();
    expect(screen.getByText("目的地不可空白")).toBeInTheDocument();
    expect(screen.getByText("請輸入有效的出發日期")).toBeInTheDocument();
    expect(screen.getByText("請輸入有效的回程日期")).toBeInTheDocument();
    expect(repository.create).not.toHaveBeenCalled();
  });

  it("rejects a return date before departure without writing", async () => {
    const user = userEvent.setup();
    const repository = createRepositoryStub();
    render(
      <TripForm
        save={(input, existingTrip) =>
          saveTrip(input, { existingTrip, repository })
        }
      />,
    );

    await user.type(screen.getByLabelText("旅程名稱"), "岡山之旅");
    await user.type(screen.getByLabelText("目的地 1"), "岡山");
    await user.type(screen.getByLabelText("出發日期"), "2026-12-22");
    await user.type(screen.getByLabelText("回程日期"), "2026-12-20");
    await user.click(screen.getByRole("button", { name: "建立旅程" }));

    expect(screen.getByText("回程日期不可早於出發日期")).toBeInTheDocument();
    expect(repository.create).not.toHaveBeenCalled();
  });

  it("rejects zero budget and missing currency without writing", async () => {
    const user = userEvent.setup();
    const repository = createRepositoryStub();
    render(
      <TripForm
        save={(input, existingTrip) =>
          saveTrip(input, { existingTrip, repository })
        }
      />,
    );

    await user.type(screen.getByLabelText("旅程名稱"), "岡山之旅");
    await user.type(screen.getByLabelText("目的地 1"), "岡山");
    await user.type(screen.getByLabelText("出發日期"), "2026-12-20");
    await user.type(screen.getByLabelText("回程日期"), "2026-12-22");
    await user.type(screen.getByLabelText("總預算"), "0");
    await user.click(screen.getByRole("button", { name: "建立旅程" }));

    expect(screen.getByText("請選擇預算幣別")).toBeInTheDocument();
    expect(repository.create).not.toHaveBeenCalled();

    await user.selectOptions(screen.getByLabelText("預算幣別"), "TWD");
    await user.click(screen.getByRole("button", { name: "建立旅程" }));

    expect(screen.getByText("金額必須是正數且不可超出安全整數範圍")).toBeInTheDocument();
    expect(repository.create).not.toHaveBeenCalled();
  });
});