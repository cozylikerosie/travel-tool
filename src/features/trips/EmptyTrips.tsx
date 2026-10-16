import { Plus } from "lucide-react";

interface EmptyTripsProps {
  onCreate: () => void;
}

export function EmptyTrips({ onCreate }: EmptyTripsProps) {
  return (
    <section
      aria-labelledby="empty-trips-heading"
      className="grid min-h-80 content-center justify-items-start gap-5 border-b border-rule py-12 md:min-h-96"
    >
      <p className="font-label text-xs uppercase tracking-[0.15em] text-muted">
        YOUR NEXT JOURNEY
      </p>
      <h2
        className="font-title text-3xl text-ink md:text-4xl"
        id="empty-trips-heading"
      >
        還沒有旅程
      </h2>
      <p className="max-w-md text-base text-muted">
        下一段旅程，從這裡開始。
      </p>
      <button
        className="inline-flex min-h-11 items-center gap-3 border border-ink bg-ink px-5 text-sm text-paper transition-colors hover:bg-transparent hover:text-ink"
        onClick={onCreate}
        type="button"
      >
        <Plus aria-hidden="true" className="size-4" />
        建立第一趟旅程
      </button>
    </section>
  );
}