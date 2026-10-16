import { ArrowLeft, Pencil, Trash2 } from "lucide-react";
import { useState } from "react";
import { formatMoney } from "../../shared/money/budget";
import { getTripDurationDays } from "../../shared/dates/tripDates";
import type { TripRepository } from "../../data/tripRepository";
import { CopyTripButton } from "./CopyTripButton";
import { DeleteTripDialog } from "./DeleteTripDialog";
import { TripForm } from "./TripForm";
import { saveTrip } from "./saveTrip";
import type { Trip, TripFormInput } from "./tripSchema";

interface TripDetailsPageProps {
  trip: Trip;
  repository: TripRepository;
  onBack: () => void;
  onSaved: (trip: Trip) => void;
  onDeleted: (id: string) => Promise<void>;
  onCopy: (initialValues: TripFormInput) => void;
}

export function TripDetailsPage({
  trip,
  repository,
  onBack,
  onSaved,
  onDeleted,
  onCopy,
}: TripDetailsPageProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);

  if (isEditing) {
    return (
      <main className="mx-auto grid min-h-screen w-full max-w-5xl content-start gap-8 px-5 py-8 md:gap-12 md:px-12 md:py-12">
        <header className="grid gap-6 border-b border-rule pb-7">
          <button
            className="inline-flex min-h-11 w-fit items-center gap-2 text-sm text-muted hover:text-ink"
            onClick={() => setIsEditing(false)}
            type="button"
          >
            <ArrowLeft aria-hidden="true" className="size-4" />
            返回旅程
          </button>
          <div className="grid gap-2">
            <p className="font-label text-xs uppercase tracking-[0.15em] text-muted">
              EDIT JOURNEY
            </p>
            <h1 className="font-title text-4xl text-ink md:text-5xl">編輯旅程</h1>
          </div>
        </header>
        <TripForm
          initialTrip={trip}
          onCancel={() => setIsEditing(false)}
          onSaved={(updatedTrip) => {
            onSaved(updatedTrip);
            setIsEditing(false);
          }}
          save={(input, existingTrip) =>
            saveTrip(input, { existingTrip, repository })
          }
        />
      </main>
    );
  }

  return (
    <main className="mx-auto grid min-h-screen w-full max-w-7xl content-start gap-10 px-5 py-8 md:gap-12 md:px-12 md:py-12">
      <header className="grid gap-6 border-b border-rule pb-7 md:pb-9">
        <button
          className="inline-flex min-h-11 w-fit items-center gap-2 text-sm text-muted hover:text-ink"
          onClick={onBack}
          type="button"
        >
          <ArrowLeft aria-hidden="true" className="size-4" />
          返回旅程列表
        </button>
        <div className="flex flex-wrap items-end justify-between gap-6">
          <div className="grid gap-2">
            <p className="font-label text-xs uppercase tracking-[0.15em] text-muted">
              JOURNEY DETAILS
            </p>
            <h1 className="font-title text-4xl leading-tight text-ink md:text-5xl">
              {trip.name}
            </h1>
            <p className="text-base text-muted">{trip.destinations.join("・")}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <CopyTripButton onCopy={onCopy} trip={trip} />
            <button
              className="inline-flex min-h-11 items-center gap-2 border border-ink px-4 text-sm text-ink hover:bg-ink hover:text-white"
              onClick={() => setIsEditing(true)}
              type="button"
            >
              <Pencil aria-hidden="true" className="size-4" />
              編輯旅程
            </button>
            <button
              className="inline-flex min-h-11 items-center gap-2 px-4 text-sm text-budget-over underline decoration-rule underline-offset-4"
              onClick={() => setIsDeleteOpen(true)}
              type="button"
            >
              <Trash2 aria-hidden="true" className="size-4" />
              刪除旅程
            </button>
          </div>
        </div>
      </header>

      <section aria-label="旅程基本資訊" className="grid gap-8 md:grid-cols-2 md:gap-12">
        <div className="grid content-start gap-2 border-b border-rule pb-6">
          <p className="font-label text-xs uppercase tracking-[0.15em] text-muted">DATES</p>
          <p className="font-display text-3xl text-ink">
            {trip.startDate.slice(5).replace("-", ".")} — {trip.endDate.slice(5).replace("-", ".")}
          </p>
          <p className="text-sm text-muted">{getTripDurationDays(trip.startDate, trip.endDate)} 天</p>
        </div>
        <div className="grid content-start gap-2 border-b border-rule pb-6">
          <p className="font-label text-xs uppercase tracking-[0.15em] text-muted">BUDGET</p>
          <p className="font-display text-3xl tabular-nums text-ink">
            {trip.budgetAmountMinor !== null && trip.budgetCurrency
              ? formatMoney(trip.budgetAmountMinor, trip.budgetCurrency)
              : "未設定"}
          </p>
        </div>
        <div className="grid content-start gap-2 border-b border-rule pb-6">
          <p className="font-label text-xs uppercase tracking-[0.15em] text-muted">COMPANIONS</p>
          <p className="text-base text-ink">{trip.companions.length ? trip.companions.join("、") : "未設定"}</p>
        </div>
        <div className="grid content-start gap-2 border-b border-rule pb-6">
          <p className="font-label text-xs uppercase tracking-[0.15em] text-muted">NOTES</p>
          <p className="whitespace-pre-wrap text-base text-ink">{trip.notes || "未設定"}</p>
        </div>
      </section>

      {isDeleteOpen && (
        <DeleteTripDialog
          onCancel={() => setIsDeleteOpen(false)}
          onConfirm={() => onDeleted(trip.id)}
          tripName={trip.name}
        />
      )}
    </main>
  );
}