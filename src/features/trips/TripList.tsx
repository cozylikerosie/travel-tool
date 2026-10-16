import { ArrowUpRight } from "lucide-react";
import {
  getTripDurationDays,
  getTripStatus,
  type TripStatus,
} from "../../shared/dates/tripDates";
import type { Trip } from "./tripSchema";

interface TripListProps {
  trips: Trip[];
  today?: string;
  onSelect?: (trip: Trip) => void;
}

const STATUS_GROUPS: { status: TripStatus; label: string }[] = [
  { status: "upcoming", label: "即將出發" },
  { status: "ongoing", label: "旅途中" },
  { status: "completed", label: "已結束" },
];

function formatDateParts(date: string) {
  const [year, month, day] = date.split("-").map(Number);
  const weekday = new Date(Date.UTC(year!, month! - 1, day!))
    .toLocaleDateString("en-US", { weekday: "short", timeZone: "UTC" })
    .toUpperCase();

  return {
    numeric: `${String(month).padStart(2, "0")}.${String(day).padStart(2, "0")}`,
    weekday,
  };
}

function TripRow({ trip, onSelect }: { trip: Trip; onSelect?: (trip: Trip) => void }) {
  const start = formatDateParts(trip.startDate);
  const end = formatDateParts(trip.endDate);
  const content = (
    <article className="grid w-full gap-4 border border-rule bg-surface p-5 text-left transition-colors hover:border-accent md:grid-cols-[minmax(120px,0.45fr)_1fr_auto] md:items-center md:gap-8 md:px-7 md:py-6">
      <div className="flex items-baseline gap-3">
        <time
          className="font-display text-3xl leading-none text-ink"
          dateTime={trip.startDate}
        >
          {start.numeric}
        </time>
        <span className="font-label text-[11px] uppercase tracking-[0.15em] text-muted">
          {start.weekday}
        </span>
        {trip.startDate !== trip.endDate && (
          <>
            <span aria-hidden="true" className="text-muted">—</span>
            <time className="font-display text-xl text-muted" dateTime={trip.endDate}>
              {end.numeric}
            </time>
          </>
        )}
      </div>
      <div className="grid gap-1">
        <h3 className="font-title text-xl leading-snug text-ink">{trip.name}</h3>
        <p className="text-sm text-muted">{trip.destinations.join("・")}</p>
      </div>
      <div className="flex items-center justify-between gap-5 md:justify-end">
        <p className="text-sm tabular-nums text-muted">
          {getTripDurationDays(trip.startDate, trip.endDate)} 天
        </p>
        {onSelect && <ArrowUpRight aria-hidden="true" className="size-4 text-muted" />}
      </div>
    </article>
  );

  return (
    <li>
      {onSelect ? (
        <button
          aria-label={`查看旅程：${trip.name}`}
          className="block w-full text-left"
          onClick={() => onSelect(trip)}
          type="button"
        >
          {content}
        </button>
      ) : (
        content
      )}
    </li>
  );
}

export function TripList({ trips, today, onSelect }: TripListProps) {
  const groups = STATUS_GROUPS.map((group) => ({
    ...group,
    trips: trips
      .filter((trip) => getTripStatus(trip.startDate, trip.endDate, today) === group.status)
      .sort((left, right) => left.startDate.localeCompare(right.startDate) || left.name.localeCompare(right.name, "zh-Hant")),
  })).filter((group) => group.trips.length > 0);

  return (
    <div className="grid gap-10 md:gap-12">
      {groups.map((group) => {
        const headingId = `trip-status-${group.status}`;
        return (
          <section
            aria-labelledby={headingId}
            className="grid gap-4"
            key={group.status}
          >
            <div className="flex items-baseline justify-between border-b border-rule pb-3">
              <h2 className="font-title text-xl text-ink" id={headingId}>
                {group.label}
              </h2>
              <span className="font-label text-xs tabular-nums text-muted">
                {String(group.trips.length).padStart(2, "0")}
              </span>
            </div>
            <ol aria-label={group.label} className="grid gap-3">
              {group.trips.map((trip) => (
                <TripRow key={trip.id} onSelect={onSelect} trip={trip} />
              ))}
            </ol>
          </section>
        );
      })}
    </div>
  );
}