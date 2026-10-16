import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { EmptyTrips } from "../../../src/features/trips/EmptyTrips";

describe("empty trip state", () => {
  it("guides the user to create the first trip", async () => {
    const user = userEvent.setup();
    const onCreate = vi.fn();
    render(<EmptyTrips onCreate={onCreate} />);

    expect(screen.getByRole("heading", { name: "還沒有旅程" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "建立第一趟旅程" }));
    expect(onCreate).toHaveBeenCalledOnce();
  });
});