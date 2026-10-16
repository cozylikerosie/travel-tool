import type { TripDay } from "../../shared/dates/tripDates";
import { formatTripDayDate, getWeekdayShort } from "../../shared/dates/tripDates";

interface DayTabsProps {
  days: TripDay[];
  selectedDayNumber: number;
  onSelect: (dayNumber: number) => void;
}

export function DayTabs({ days, selectedDayNumber, onSelect }: DayTabsProps) {
  return (
    <div
      aria-label="旅程日"
      className="flex gap-1 overflow-x-auto border-b border-rule"
      role="tablist"
    >
      {days.map((day) => {
        const isSelected = day.dayNumber === selectedDayNumber;
        return (
          <button
            aria-label={day.label}
            aria-selected={isSelected}
            className={`grid min-h-14 shrink-0 content-center gap-0.5 border-b-2 px-4 py-2 text-left transition-colors ${
              isSelected ? "border-ink text-ink" : "border-transparent text-muted hover:text-ink"
            }`}
            key={day.dayNumber}
            onClick={() => onSelect(day.dayNumber)}
            role="tab"
            type="button"
          >
            <span className="font-display text-lg leading-none">Day {day.dayNumber}</span>
            <span className="font-label text-[11px] uppercase tracking-[0.15em]">
              {formatTripDayDate(day.date)} {getWeekdayShort(day.date)}
            </span>
          </button>
        );
      })}
    </div>
  );
}
