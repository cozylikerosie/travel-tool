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
import { useState } from "react";

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
  isPlaceholder: boolean;
  error?: string;
  onChange: (index: number, value: string) => void;
  onRemove: (index: number) => void;
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
          className={`min-h-12 w-full border-b bg-transparent px-0 py-2 text-base text-ink outline-none focus:border-ink ${error ? "border-budget-over" : "border-rule"}`}
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
      className={`flex min-h-[68px] items-center gap-1 border-b px-1 transition-colors ${isDragging ? "border-2 border-dashed border-ink" : "border-rule"}`}
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
    <div className="flex min-h-[68px] items-center gap-1 border border-ink bg-surface px-1 ring-1 ring-accent/30 [transform:scale(1.02)_rotate(-0.3deg)]" data-testid="sortable-overlay">
      <span aria-hidden="true" className="grid size-11 shrink-0 place-items-center text-muted">
        <GripVertical className="size-5" strokeWidth={1.5} />
      </span>
      <span className="grid min-w-0 flex-1 gap-1">
        <span className="text-xs text-muted">目的地 {index + 1}</span>
        <span className="border-b border-rule py-2 text-base text-ink">{value}</span>
      </span>
      <span aria-hidden="true" className="size-11 shrink-0" />
    </div>
  );
}

export function SortableDestinations({
  items,
  error,
  onChange,
  onRemove,
}: SortableDestinationsProps) {
  const [activeId, setActiveId] = useState<string | null>(null);
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 180, tolerance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  const activeIndex = activeId === null ? -1 : Number(activeId);
  const activeValue = items[activeIndex];

  function handleDragStart(event: DragStartEvent) {
    setActiveId(String(event.active.id));
  }

  function handleDragEnd(event: DragEndEvent) {
    setActiveId(null);
    if (!event.over || event.active.id === event.over.id) return;

    const oldIndex = Number(event.active.id);
    const newIndex = Number(event.over.id);
    if (
      Number.isInteger(oldIndex) &&
      Number.isInteger(newIndex) &&
      oldIndex >= 0 &&
      newIndex >= 0 &&
      oldIndex < items.length &&
      newIndex < items.length
    ) {
      onChange(arrayMove(items, oldIndex, newIndex));
    }
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
        items={items.map((_, index) => String(index))}
        strategy={verticalListSortingStrategy}
      >
        <ol aria-label="可排序目的地" className="grid">
          {items.map((value, index) => (
            <SortableDestinationRow
              error={index === 0 ? error : undefined}
              id={String(index)}
              index={index}
              isPlaceholder={activeIndex === index}
              key={index}
              onChange={onChange === undefined ? () => undefined : (itemIndex, nextValue) => {
                onChange(items.map((item, currentIndex) => currentIndex === itemIndex ? nextValue : item));
              }}
              onRemove={onRemove}
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