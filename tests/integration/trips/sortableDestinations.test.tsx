import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { SortableDestinations } from "../../../src/features/trips/SortableDestinations";

function SortableHarness({
  onRemove = vi.fn(),
  onChange,
}: {
  onRemove?: (index: number) => void;
  onChange?: (items: string[]) => void;
}) {
  const [items, setItems] = useState(["岡山", "香川", "愛媛"]);
  return (
    <SortableDestinations
      items={items}
      onChange={(nextItems) => {
        setItems(nextItems);
        onChange?.(nextItems);
      }}
      onRemove={onRemove}
    />
  );
}

afterEach(async () => {
  vi.restoreAllMocks();
  // dnd-kit 在拖曳結束後 50ms 內攔截 document click，等它解除以免影響下一個測試。
  await new Promise((resolve) => setTimeout(resolve, 60));
});

function mockSortableRects() {
  vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(function (this: HTMLElement) {
    const index = this.getAttribute("data-sort-index");
    if (index !== null) return new DOMRect(0, Number(index) * 72, 360, 68);
    return new DOMRect(0, 0, 360, 68);
  });
}

describe("sortable destinations", () => {
  it("exposes an accessible drag handle and current ordinal for every destination", () => {
    render(<SortableHarness />);

    expect(screen.getByRole("button", { name: "拖曳排序目的地：岡山" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "拖曳排序目的地：香川" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "拖曳排序目的地：愛媛" })).toBeInTheDocument();
    expect(screen.getByLabelText("目的地 1")).toHaveValue("岡山");
    expect(screen.getByLabelText("目的地 2")).toHaveValue("香川");
    expect(screen.getByLabelText("目的地 3")).toHaveValue("愛媛");
  });

  it("reorders with the keyboard, updates ordinals immediately, and reports the new order", async () => {
    const onChange = vi.fn();
    mockSortableRects();
    render(<SortableHarness onChange={onChange} />);

    const handle = screen.getByRole("button", { name: "拖曳排序目的地：岡山" });
    handle.focus();
    fireEvent.keyDown(handle, { code: "Space", key: " " });
    await waitFor(() => expect(screen.getByTestId("sortable-overlay")).toBeInTheDocument());
    const placeholder = screen.getAllByTestId("sortable-destination")[0]!;
    expect(placeholder.className).toContain("border-dashed");
    expect(placeholder).toHaveAttribute("data-drag-placeholder", "true");
    await new Promise((resolve) => setTimeout(resolve, 0));
    fireEvent.keyDown(document, { code: "ArrowDown", key: "ArrowDown" });
    fireEvent.keyDown(document, { code: "Space", key: " " });

    expect(onChange).toHaveBeenLastCalledWith(["香川", "岡山", "愛媛"]);
    const rows = screen.getAllByTestId("sortable-destination");
    expect(rows).toHaveLength(3);
    expect(within(rows[0]!).getByLabelText("目的地 1")).toHaveValue("香川");
    expect(within(rows[1]!).getByLabelText("目的地 2")).toHaveValue("岡山");
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "拖曳排序目的地：岡山" })).toHaveFocus(),
    );
  });

  it("reorders with a mouse drag", async () => {
    const onChange = vi.fn();
    mockSortableRects();
    render(<SortableHarness onChange={onChange} />);
    const handle = screen.getByRole("button", { name: "拖曳排序目的地：岡山" });

    fireEvent.mouseDown(handle, { button: 0, clientX: 20, clientY: 20 });
    fireEvent.mouseMove(document, { clientX: 20, clientY: 100 });
    expect(await screen.findByTestId("sortable-overlay")).toBeInTheDocument();
    fireEvent.mouseMove(document, { clientX: 20, clientY: 100 });
    fireEvent.mouseUp(document, { button: 0, clientX: 20, clientY: 100 });

    expect(onChange).toHaveBeenLastCalledWith(["香川", "岡山", "愛媛"]);
  });

  it("reorders with a touch drag", async () => {
    const onChange = vi.fn();
    mockSortableRects();
    render(<SortableHarness onChange={onChange} />);
    const handle = screen.getByRole("button", { name: "拖曳排序目的地：岡山" });
    const startTouch = { identifier: 1, target: handle, clientX: 20, clientY: 20 };
    const endTouch = { identifier: 1, target: handle, clientX: 20, clientY: 100 };

    fireEvent.touchStart(handle, { touches: [startTouch], changedTouches: [startTouch] });
    expect(await screen.findByTestId("sortable-overlay", {}, { timeout: 1000 })).toBeInTheDocument();
    // TouchSensor 監聽觸控起點元素，後續事件須送到同一個把手。
    fireEvent.touchMove(handle, { touches: [endTouch], changedTouches: [endTouch] });
    fireEvent.touchEnd(handle, { touches: [], changedTouches: [endTouch] });

    expect(onChange).toHaveBeenLastCalledWith(["香川", "岡山", "愛媛"]);
  });

  it("releases focus from another field when a touch drag starts", () => {
    render(
      <>
        <input aria-label="同行者 1" />
        <SortableHarness />
      </>,
    );
    const companionInput = screen.getByLabelText("同行者 1");
    companionInput.focus();
    const handle = screen.getByRole("button", { name: "拖曳排序目的地：愛媛" });
    const touch = { identifier: 1, target: handle, clientX: 20, clientY: 20 };

    fireEvent.touchStart(handle, { touches: [touch], changedTouches: [touch] });
    expect(companionInput).not.toHaveFocus();
    fireEvent.touchEnd(handle, { touches: [], changedTouches: [touch] });
  });

  it("allows removing an item without changing the relative order of others", async () => {
    const user = userEvent.setup();
    const onRemove = vi.fn();
    render(<SortableHarness onRemove={onRemove} />);

    await user.click(screen.getByRole("button", { name: "移除目的地：香川" }));
    expect(onRemove).toHaveBeenCalledWith(1);
  });
});