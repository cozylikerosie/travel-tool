import type { ReactNode } from "react";
import { vi } from "vitest";

// react-leaflet 測試替身：jsdom 無法可靠渲染 Leaflet，
// 改以帶 data-* 屬性的 DOM 呈現標記、線段與圖磚，供整合測試斷言。
// 使用方式：vi.mock("react-leaflet", () => import("../../mocks/reactLeaflet"));

interface EventHandlers {
  [event: string]: ((...args: unknown[]) => void) | undefined;
}

export const mockMap = {
  fitBounds: vi.fn(),
  setView: vi.fn(),
  panTo: vi.fn(),
  invalidateSize: vi.fn(),
  getBounds: vi.fn((): { contains: (point: unknown) => boolean } => ({ contains: () => false })),
};

export function resetMockMap() {
  mockMap.fitBounds.mockReset();
  mockMap.setView.mockReset();
  mockMap.panTo.mockReset();
  mockMap.invalidateSize.mockReset();
  mockMap.getBounds.mockReset();
  mockMap.getBounds.mockImplementation(() => ({ contains: () => false }));
}

export function useMap() {
  return mockMap;
}

export function MapContainer({ children }: { children?: ReactNode }) {
  return <div data-testid="map">{children}</div>;
}

export function TileLayer({
  url,
  attribution,
  eventHandlers,
}: {
  url: string;
  attribution?: string;
  eventHandlers?: EventHandlers;
}) {
  return (
    <div data-attribution={attribution} data-testid="tile-layer" data-url={url}>
      <button onClick={() => eventHandlers?.tileerror?.()} type="button">
        觸發圖磚錯誤
      </button>
    </div>
  );
}

interface MockIcon {
  options: { html?: string; className?: string };
}

export function Marker({
  icon,
  title,
  eventHandlers,
}: {
  icon?: MockIcon;
  title?: string;
  eventHandlers?: EventHandlers;
}) {
  const order = icon?.options.html?.replace(/<[^>]*>/g, "") ?? "";
  const isSelected = icon?.options.className?.includes("map-marker--selected") ?? false;
  return (
    <button
      aria-label={`地圖標記 ${order}：${title ?? ""}`}
      data-order={order}
      data-selected={String(isSelected)}
      data-testid="map-marker"
      onClick={() => eventHandlers?.click?.()}
      type="button"
    />
  );
}

export function Polyline({
  positions,
  pathOptions,
}: {
  positions: unknown;
  pathOptions?: { className?: string };
}) {
  const className = pathOptions?.className ?? "";
  const mode = /map-line-mode-(\w+)/.exec(className)?.[1] ?? "";
  return (
    <div
      className={className}
      data-mode={mode}
      data-positions={JSON.stringify(positions)}
      data-testid="map-line"
    />
  );
}
