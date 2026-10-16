import { Plus } from "lucide-react";
import { EmptyTrips } from "./EmptyTrips";
import { TripList } from "./TripList";
import type { Trip } from "./tripSchema";

interface TripHomePageProps {
  trips: Trip[];
  today?: string;
  onCreate: () => void;
  onSelect?: (trip: Trip) => void;
}

export function TripHomePage({ trips, today, onCreate, onSelect }: TripHomePageProps) {
  return (
    <main className="mx-auto grid min-h-screen w-full max-w-7xl content-start gap-10 px-5 py-8 md:gap-12 md:px-12 md:py-12">
      <header className="flex flex-wrap items-end justify-between gap-6 border-b border-rule pb-7 md:pb-9">
        <div className="grid gap-2">
          <p className="font-label text-xs uppercase tracking-[0.15em] text-muted">
            TRAVEL NOTES / PERSONAL ARCHIVE
          </p>
          <h1 className="font-title text-4xl leading-tight text-ink md:text-5xl">
            我的旅程
          </h1>
        </div>
        {trips.length > 0 && (
          <button
            className="inline-flex min-h-11 items-center gap-3 border border-ink px-5 text-sm text-ink transition-colors hover:bg-ink hover:text-paper"
            onClick={onCreate}
            type="button"
          >
            <Plus aria-hidden="true" className="size-4" />
            建立旅程
          </button>
        )}
      </header>

      {trips.length === 0 ? (
        <EmptyTrips onCreate={onCreate} />
      ) : (
        <TripList onSelect={onSelect} today={today} trips={trips} />
      )}
    </main>
  );
}