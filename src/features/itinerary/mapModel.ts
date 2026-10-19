// 地圖模型：把當天地點與交通段轉成標記、連線與視窗範圍。
// 純函式、不 import leaflet，方便在 jsdom 中測試。
import type { Place, TransportSegment } from "./itinerarySchema";
import { listAdjacentPairs, segmentId } from "./itineraryOrdering";
import {
  getTransportMode,
  type LineColor,
  type LineStyle,
  type TransportModeCode,
} from "./transportModes";

export type LatLngTuple = [number, number];
export type BoundsTuple = [LatLngTuple, LatLngTuple];

export interface MapMarker {
  placeId: string;
  order: number;
  name: string;
  position: LatLngTuple;
  isSelected: boolean;
}

export interface MapLine {
  id: string;
  fromPlaceId: string;
  toPlaceId: string;
  positions: [LatLngTuple, LatLngTuple];
  mode: TransportModeCode | null;
  lineStyle: LineStyle;
  className: string;
  // true 表示中間略過了沒有座標的地點，以未設定的灰線連接前後兩個有座標的地點
  bridgesManualPlaces: boolean;
}

export type MapViewport =
  | { kind: "bounds"; bounds: BoundsTuple }
  | { kind: "center"; center: LatLngTuple; zoom: number };

// 南至印尼、北至北海道、西至緬甸、東至日本東岸
export const ASIA_DEFAULT_BOUNDS: BoundsTuple = [
  [-11, 92],
  [46, 146],
];

const SINGLE_POINT_ZOOM = 14;

function toTuple(place: Place): LatLngTuple | null {
  return place.coordinates ? [place.coordinates.lat, place.coordinates.lng] : null;
}

export function lineClassName(color: LineColor): string {
  return `map-line map-line--${color}`;
}

// 標記編號使用時間軸順序（含手動地點），因此可能不連續
export function buildMapMarkers(sortedPlaces: readonly Place[], selectedPlaceId: string | null): MapMarker[] {
  return sortedPlaces.flatMap((place, index) => {
    const position = toTuple(place);
    if (!position) return [];
    return [
      {
        placeId: place.id,
        order: index + 1,
        name: place.name,
        position,
        isSelected: place.id === selectedPlaceId,
      },
    ];
  });
}

// 依時間軸順序連接有座標的地點；中間若有沒有座標的地點，略過它直接連接前後兩點（灰線）
export function buildMapLines(
  sortedPlaces: readonly Place[],
  segments: readonly Pick<TransportSegment, "id" | "mode">[],
): MapLine[] {
  const modes = new Map(segments.map((segment) => [segment.id, segment.mode]));
  const mapped = sortedPlaces.flatMap((place, index) => {
    const position = toTuple(place);
    return position ? [{ place, index, position }] : [];
  });

  return listAdjacentPairs(mapped).map(([from, to]) => {
    const bridgesManualPlaces = to.index - from.index > 1;
    const id = segmentId(from.place.id, to.place.id);
    const mode = bridgesManualPlaces ? null : (modes.get(id) ?? null);
    const { lineStyle } = getTransportMode(mode);
    return {
      id,
      fromPlaceId: from.place.id,
      toPlaceId: to.place.id,
      positions: [from.position, to.position],
      mode,
      lineStyle,
      className: `${lineClassName(lineStyle.color)} map-line-mode-${mode ?? "unset"}`,
      bridgesManualPlaces,
    };
  });
}

function viewportFor(points: LatLngTuple[]): MapViewport | null {
  if (!points.length) return null;
  if (points.length === 1) return { kind: "center", center: points[0]!, zoom: SINGLE_POINT_ZOOM };
  const lats = points.map(([lat]) => lat);
  const lngs = points.map(([, lng]) => lng);
  return {
    kind: "bounds",
    bounds: [
      [Math.min(...lats), Math.min(...lngs)],
      [Math.max(...lats), Math.max(...lngs)],
    ],
  };
}

function coordinatesOf(places: readonly Place[]): LatLngTuple[] {
  return places.flatMap((place) => {
    const point = toTuple(place);
    return point ? [point] : [];
  });
}

export function getMapViewport(dayPlaces: readonly Place[], tripPlaces: readonly Place[]): MapViewport {
  return (
    viewportFor(coordinatesOf(dayPlaces)) ??
    viewportFor(coordinatesOf(tripPlaces)) ?? { kind: "bounds", bounds: ASIA_DEFAULT_BOUNDS }
  );
}

// 與 tailwind.css 的主題規則一致：data-theme 優先，沒有時才看系統設定
export function resolveTileTheme(dataTheme: string | null, prefersDark: boolean): "light" | "dark" {
  if (dataTheme === "light" || dataTheme === "dark") return dataTheme;
  return prefersDark ? "dark" : "light";
}
