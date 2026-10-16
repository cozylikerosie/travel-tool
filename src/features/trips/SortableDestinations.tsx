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
  type DragStartEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, X } from "lucide-react";
import { useState, type SyntheticEvent } from "react";

interface SortableDestinationsProps {
  items: string[];
  error?: string;
  onChange: (items: string[]) => void;
  onRemove: (index: number) => void;
}

interface SortableDestinationRowProps {
  id: string;
  index: number;
  value: string;
  error?: string;
  onChange: (index: number, value: string) => void;
  onRemove: (index: number) => void;
}

// 觸控拖曳開始時若其他輸入框仍有焦點，瀏覽器會捲回該輸入框而中斷拖曳，因此先釋放焦點。
function releaseOtherFocus(event: SyntheticEvent<HTMLElement>) {
  const active = document.activeElement;
  if (active instanceof HTMLElement && active !== event.currentTarget) active.blur();
}

function DestinationContent({
  index,
  value,
  onChange,
  onRemove,
  attributes,
  listeners,
  setActivatorNodeRef,
  error,
}: SortableDestinationRowProps & {
  attributes: ReturnType<typeof useSortable>["attributes"];
  listeners: ReturnType<typeof useSortable>["listeners"];
  setActivatorNodeRef: ReturnType<typeof useSortable>["setActivatorNodeRef"];
}) {
  const errorId = `destination-${index}-error`;

  return (
    <>
      <button
        {...attributes}
        {...listeners}
        aria-label={`拖曳排序目的地：${value || `目的地 ${index + 1}`}`}
        className="grid size-11 shrink-0 cursor-grab place-items-center text-muted active:cursor-grabbing"
        onMouseDownCapture={releaseOtherFocus}
        onTouchStartCapture={releaseOtherFocus}
        ref={setActivatorNodeRef}
        style={{ touchAction: "none" }}
        type="button"
      >
        <GripVertical aria-hidden="true" className="size-5" strokeWidth={1.5} />
      </button>
      <label className="grid min-w-0 flex-1 gap-1">
        <span className="text-xs text-muted">目的地 {index + 1}</span>
        <input
          aria-label={`目的地 ${index + 1}`}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? errorId : undefined}
          className="min-h-12 w-full bg-transparent px-0 py-2 text-base text-ink outline-none"
          onChange={(event) => onChange(index, event.target.value)}
          value={value}
        />
        {error && <span className="text-sm text-budget-over" id={errorId} role="alert">{error}</span>}
      </label>
      <button
        aria-label={`移除目的地：${value || `目的地 ${index + 1}`}`}
        className="grid size-11 shrink-0 place-items-center text-muted hover:text-ink"
        onClick={() => onRemove(index)}
        type="button"
      >
        <X aria-hidden="true" className="size-4" />
      </button>
    </>
  );
}

function SortableDestinationRow(props: SortableDestinationRowProps) {
  const {
    attributes,
    isDragging,
    listeners,
    setActivatorNodeRef,
    setNodeRef,
    transform,
    transition,
  } = useSortable({ id: props.id });

  return (
    <li
      className={`flex min-h-[68px] items-center gap-1 border-b px-1 pt-3 transition-colors ${isDragging ? "border-2 border-dashed border-ink" : props.error ? "border-budget-over" : "border-rule focus-within:border-ink"}`}
      data-sort-index={props.index}
      data-drag-placeholder={isDragging ? "true" : undefined}
      data-testid="sortable-destination"
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
      }}
    >
      <div className={`flex min-w-0 flex-1 items-center gap-1 ${isDragging ? "opacity-0" : ""}`}>
        <DestinationContent
          {...props}
          attributes={attributes}
          listeners={listeners}
          setActivatorNodeRef={setActivatorNodeRef}
        />
      </div>
    </li>
  );
}

function DraggedDestination({ index, value }: { index: number; value: string }) {
  return (
    <div className="flex min-h-[68px] items-center gap-1 border border-ink bg-surface px-1 pt-3 ring-1 ring-accent/30 [transform:scale(1.02)_rotate(-0.3deg)]" data-testid="sortable-overlay">
      <span aria-hidden="true" className="grid size-11 shrink-0 place-items-center text-muted">
        <GripVertical className="size-5" strokeWidth={1.5} />
      </span>
      <span className="grid min-w-0 flex-1 gap-1">
        <span className="text-xs text-muted">目的地 {index + 1}</span>
        <span className="py-2 text-base text-ink">{value}</span>
      </span>
      <span aria-hidden="true" className="size-11 shrink-0" />
    </div>
  );
}

let nextDestinationKey = 0;

function createDestinationKeys(count: number): string[] {
  return Array.from({ length: count }, () => `destination-${nextDestinationKey++}`);
}

export function SortableDestinations({
  items,
  error,
  onChange,
  onRemove,
}: SortableDestinationsProps) {
  const [activeId, setActiveId] = useState<string | null>(null);
  // 以穩定 key 追蹤每個目的地，排序後焦點與拖曳狀態才會跟著同一個項目移動。
  const [keys, setKeys] = useState(() => createDestinationKeys(items.length));
  let currentKeys = keys;
  if (keys.length !== items.length) {
    currentKeys = keys.length < items.length
      ? [...keys, ...createDestinationKeys(items.length - keys.length)]
      : keys.slice(0, items.length);
    setKeys(currentKeys);
  }
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 180, tolerance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  const activeIndex = activeId === null ? -1 : currentKeys.indexOf(activeId);
  const activeValue = items[activeIndex];

  function handleDragStart(event: DragStartEvent) {
    setActiveId(String(event.active.id));
  }

  function handleDragEnd(event: DragEndEvent) {
    setActiveId(null);
    if (!event.over || event.active.id === event.over.id) return;

    const oldIndex = currentKeys.indexOf(String(event.active.id));
    const newIndex = currentKeys.indexOf(String(event.over.id));
    if (oldIndex < 0 || newIndex < 0) return;

    setKeys(arrayMove(currentKeys, oldIndex, newIndex));
    onChange(arrayMove(items, oldIndex, newIndex));
  }

  function handleRemove(index: number) {
    setKeys(currentKeys.filter((_, keyIndex) => keyIndex !== index));
    onRemove(index);
  }

  return (
    <DndContext
      collisionDetection={closestCenter}
      onDragCancel={() => setActiveId(null)}
      onDragEnd={handleDragEnd}
      onDragStart={handleDragStart}
      sensors={sensors}
    >
      <SortableContext
        items={currentKeys}
        strategy={verticalListSortingStrategy}
      >
        <ol aria-label="可排序目的地" className="grid">
          {items.map((value, index) => (
            <SortableDestinationRow
              error={index === 0 ? error : undefined}
              id={currentKeys[index]!}
              index={index}
              key={currentKeys[index]}
              onChange={(itemIndex, nextValue) => {
                onChange(items.map((item, currentIndex) => currentIndex === itemIndex ? nextValue : item));
              }}
              onRemove={handleRemove}
              value={value}
            />
          ))}
        </ol>
      </SortableContext>
      <DragOverlay dropAnimation={null}>
        {activeIndex >= 0 && activeValue !== undefined ? (
          <DraggedDestination index={activeIndex} value={activeValue} />
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}