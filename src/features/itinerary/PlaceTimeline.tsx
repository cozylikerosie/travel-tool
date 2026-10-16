import {
  closestCenter,
  DndContext,
  DragOverlay,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, Plus } from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { deriveDepartureTime, type Place } from "./itinerarySchema";
import { listAdjacentPairs } from "./itineraryOrdering";

interface PlaceTimelineProps {
  dayLabel: string;
  places: Place[];
  selectedPlaceId?: string | null;
  scrollToSelected?: boolean;
  onSelectPlace?: (placeId: string) => void;
  onAdd: () => void;
  onReorder?: (placeId: string, toIndex: number) => void;
  renderSegment?: (from: Place, to: Place) => ReactNode;
  renderActions?: (place: Place) => ReactNode;
}

function displayName(place: Place): string {
  return place.name || "未命名地點";
}

function describeStay(place: Place): string {
  const { stay } = place;
  if (stay.kind === "departure") return `${stay.time} 離開`;
  if (stay.kind === "duration") {
    const hours = Math.floor(stay.minutes / 60);
    const minutes = stay.minutes % 60;
    const duration = [hours ? `${hours} 小時` : "", minutes ? `${minutes} 分鐘` : ""].filter(Boolean).join(" ");
    const departure = deriveDepartureTime(place.arrivalTime, stay.minutes);
    return `停留 ${duration}・${departure.nextDay ? "隔天 " : ""}${departure.time} 離開`;
  }
  return "";
}

interface PlaceItemProps {
  place: Place;
  index: number;
  isSelected: boolean;
  canReorder: boolean;
  segment: ReactNode;
  actions: ReactNode;
  onSelectPlace?: (placeId: string) => void;
  registerItem: (placeId: string, element: HTMLLIElement | null) => void;
}

function SortablePlaceItem({
  place,
  index,
  isSelected,
  canReorder,
  segment,
  actions,
  onSelectPlace,
  registerItem,
}: PlaceItemProps) {
  const { attributes, isDragging, listeners, setActivatorNodeRef, setNodeRef, transform, transition } =
    useSortable({ id: place.id, disabled: !canReorder });
  const stayText = describeStay(place);

  return (
    <li
      aria-current={isSelected ? "true" : undefined}
      className={`grid bg-paper ${isDragging ? "relative z-10 outline-2 outline-dashed outline-ink" : ""}`}
      data-sort-index={index}
      ref={(element) => {
        setNodeRef(element);
        registerItem(place.id, element);
      }}
      style={{ transform: CSS.Transform.toString(transform), transition }}
    >
      <article
        className={`grid grid-cols-[2.75rem_2.5rem_minmax(0,1fr)_auto] items-start gap-2 border-t border-l-2 border-t-rule py-5 pr-1 transition-colors ${
          isSelected ? "border-l-accent bg-surface" : "border-l-transparent"
        } ${isDragging ? "opacity-0" : ""}`}
      >
        {canReorder ? (
          <button
            {...attributes}
            {...listeners}
            aria-label={`拖曳調整順序：${displayName(place)}`}
            className="grid size-11 cursor-grab place-items-center text-muted hover:text-ink active:cursor-grabbing"
            ref={setActivatorNodeRef}
            style={{ touchAction: "none" }}
            type="button"
          >
            <GripVertical aria-hidden="true" className="size-5" />
          </button>
        ) : (
          <span aria-hidden="true" />
        )}
        <span className="pt-1 font-display text-3xl leading-none text-accent">{index + 1}</span>
        <button
          aria-label={`選取地點：${displayName(place)}`}
          className="grid min-w-0 gap-1 text-left"
          onClick={() => onSelectPlace?.(place.id)}
          type="button"
        >
          <span className="font-label text-sm tabular-nums tracking-[0.1em] text-muted">{place.arrivalTime}</span>
          <span className="font-title text-lg leading-snug text-ink" data-testid="place-name">
            {displayName(place)}
          </span>
          {place.address && <span className="text-sm text-muted">{place.address}</span>}
          {stayText && <span className="text-sm text-muted">{stayText}</span>}
          {!place.coordinates && <span className="text-xs text-muted">未標於地圖</span>}
          {place.notes && <span className="whitespace-pre-wrap text-sm text-ink">{place.notes}</span>}
        </button>
        {actions ? <div className="flex gap-1">{actions}</div> : <span />}
      </article>
      {!isDragging && segment}
    </li>
  );
}

function DraggedPlace({ place, index }: { place: Place; index: number }) {
  return (
    <div
      className="grid grid-cols-[2.75rem_2.5rem_minmax(0,1fr)] items-center gap-2 border border-ink bg-surface py-4 ring-1 ring-accent/30 [transform:scale(1.02)_rotate(-0.3deg)]"
      data-testid="place-drag-overlay"
    >
      <span aria-hidden="true" className="grid size-11 place-items-center text-muted">
        <GripVertical className="size-5" />
      </span>
      <span className="font-display text-3xl leading-none text-accent">{index + 1}</span>
      <span className="grid gap-1">
        <span className="font-label text-sm tabular-nums tracking-[0.1em] text-muted">{place.arrivalTime}</span>
        <span className="font-title text-lg leading-snug text-ink">{displayName(place)}</span>
      </span>
    </div>
  );
}

export function PlaceTimeline({
  dayLabel,
  places,
  selectedPlaceId = null,
  scrollToSelected = false,
  onSelectPlace,
  onAdd,
  onReorder,
  renderSegment,
  renderActions,
}: PlaceTimelineProps) {
  const itemRefs = useRef(new Map<string, HTMLLIElement>());
  const [activeId, setActiveId] = useState<string | null>(null);
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 180, tolerance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  useEffect(() => {
    if (!scrollToSelected || !selectedPlaceId) return;
    itemRefs.current.get(selectedPlaceId)?.scrollIntoView({ block: "nearest" });
  }, [scrollToSelected, selectedPlaceId]);

  if (!places.length) {
    return (
      <div className="grid justify-items-start gap-4 border-t border-rule py-10">
        <p className="font-title text-xl text-ink">這一天還沒有安排地點</p>
        <p className="max-w-md text-sm text-muted">
          從 Google 地圖複製座標或電腦版網址貼上，或直接輸入地點名稱，再填寫抵達時間。
        </p>
        <button
          className="inline-flex min-h-11 items-center gap-2 border border-ink px-4 text-sm text-ink hover:bg-ink hover:text-paper"
          onClick={onAdd}
          type="button"
        >
          <Plus aria-hidden="true" className="size-4" />
          新增地點
        </button>
      </div>
    );
  }

  const segmentsAfter = new Map(
    listAdjacentPairs(places).map(([from, to]) => [from.id, renderSegment?.(from, to)]),
  );
  const canReorder = Boolean(onReorder) && places.length > 1;
  const activeIndex = places.findIndex((place) => place.id === activeId);

  function handleDragEnd(event: DragEndEvent) {
    setActiveId(null);
    if (!event.over || event.active.id === event.over.id) return;
    const toIndex = places.findIndex((place) => place.id === event.over!.id);
    if (toIndex >= 0) onReorder?.(String(event.active.id), toIndex);
  }

  return (
    <DndContext
      collisionDetection={closestCenter}
      onDragCancel={() => setActiveId(null)}
      onDragEnd={handleDragEnd}
      onDragStart={(event) => setActiveId(String(event.active.id))}
      sensors={sensors}
    >
      <SortableContext items={places.map((place) => place.id)} strategy={verticalListSortingStrategy}>
        <ol aria-label={`${dayLabel} 的地點`} className="grid">
          {places.map((place, index) => (
            <SortablePlaceItem
              actions={renderActions?.(place)}
              canReorder={canReorder}
              index={index}
              isSelected={place.id === selectedPlaceId}
              key={place.id}
              onSelectPlace={onSelectPlace}
              place={place}
              registerItem={(placeId, element) => {
                if (element) itemRefs.current.set(placeId, element);
                else itemRefs.current.delete(placeId);
              }}
              segment={segmentsAfter.get(place.id)}
            />
          ))}
        </ol>
      </SortableContext>
      <DragOverlay dropAnimation={null}>
        {activeIndex >= 0 ? <DraggedPlace index={activeIndex} place={places[activeIndex]!} /> : null}
      </DragOverlay>
    </DndContext>
  );
}
