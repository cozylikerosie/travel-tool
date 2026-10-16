import { fromMinutes, toMinutes, type Place, type TransportSegment } from "./itinerarySchema";

// 依抵達時間（HH:mm 字串可直接比較）排序，相同時依加入當天的先後順序
export function sortPlaces<T extends Pick<Place, "arrivalTime" | "dayOrder">>(places: readonly T[]): T[] {
  return [...places].sort(
    (left, right) =>
      left.arrivalTime.localeCompare(right.arrivalTime) || left.dayOrder - right.dayOrder,
  );
}

export function listAdjacentPairs<T>(sortedPlaces: readonly T[]): [T, T][] {
  return sortedPlaces.slice(1).map((place, index) => [sortedPlaces[index]!, place]);
}

export function segmentId(fromPlaceId: string, toPlaceId: string): string {
  return `${fromPlaceId}->${toPlaceId}`;
}

// 回傳起點與終點已不再相鄰的交通段 ID（Clarification Q1:C）
export function findStaleSegmentIds(
  sortedPlaces: readonly Pick<Place, "id">[],
  segments: readonly Pick<TransportSegment, "id" | "fromPlaceId" | "toPlaceId">[],
): string[] {
  const adjacentIds = new Set(
    listAdjacentPairs(sortedPlaces).map(([from, to]) => segmentId(from.id, to.id)),
  );
  return segments
    .filter((segment) => !adjacentIds.has(segmentId(segment.fromPlaceId, segment.toPlaceId)))
    .map((segment) => segment.id);
}

export function nextDayOrder(places: readonly Pick<Place, "dayOrder">[]): number {
  return places.reduce((max, place) => Math.max(max, place.dayOrder), 0) + 1;
}

export function moveItem<T>(items: readonly T[], fromIndex: number, toIndex: number): T[] {
  const next = [...items];
  const [item] = next.splice(fromIndex, 1);
  next.splice(toIndex, 0, item!);
  return next;
}

const REORDER_EDGE_MINUTES = 30;
const LAST_MINUTE_OF_DAY = 24 * 60 - 1;

// 拖曳排序後只調整被拖曳地點的抵達時間：
// 夾在兩點之間取中間時間，拖到最前面比下一點早 30 分鐘，拖到最後面比前一點晚 30 分鐘
export function arrivalTimeForReorder(
  sortedPlaces: readonly Pick<Place, "arrivalTime">[],
  fromIndex: number,
  toIndex: number,
): string {
  const reordered = moveItem(sortedPlaces, fromIndex, toIndex);
  const moved = reordered[toIndex]!;
  const previous = reordered[toIndex - 1];
  const next = reordered[toIndex + 1];

  if (previous && next) {
    return fromMinutes(Math.floor((toMinutes(previous.arrivalTime) + toMinutes(next.arrivalTime)) / 2));
  }
  if (next) return fromMinutes(Math.max(0, toMinutes(next.arrivalTime) - REORDER_EDGE_MINUTES));
  if (previous) {
    return fromMinutes(Math.min(LAST_MINUTE_OF_DAY, toMinutes(previous.arrivalTime) + REORDER_EDGE_MINUTES));
  }
  return moved.arrivalTime;
}
