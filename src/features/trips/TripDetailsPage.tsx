import { ArrowLeft, CalendarDays, Pencil, Trash2 } from "lucide-react";
import { useState } from "react";
import { formatMoney } from "../../shared/money/budget";
import { getTripDurationDays, listTripDays, type TripDay } from "../../shared/dates/tripDates";
import {
  itineraryRepository as defaultItineraryRepository,
  type ItineraryRepository,
  type PlacesBeyondDay,
  type RemovedDaysResolution,
} from "../../data/itineraryRepository";
import type { TripRepository } from "../../data/tripRepository";
import { CopyTripButton } from "./CopyTripButton";
import { DeleteTripDialog } from "./DeleteTripDialog";
import { RemovedDaysDialog } from "./RemovedDaysDialog";
import { TripForm } from "./TripForm";
import { saveTrip, type SaveTripResult } from "./saveTrip";
import { tripFormSchema, type Trip, type TripFormInput } from "./tripSchema";

interface TripDetailsPageProps {
  trip: Trip;
  repository: TripRepository;
  itineraryRepository?: ItineraryRepository;
  onBack: () => void;
  onSaved: (trip: Trip) => void;
  onDeleted: (id: string) => Promise<void>;
  onCopy: (initialValues: TripFormInput) => void;
  onOpenItinerary: () => void;
}

export function TripDetailsPage({
  trip,
  repository,
  itineraryRepository = defaultItineraryRepository,
  onBack,
  onSaved,
  onDeleted,
  onCopy,
  onOpenItinerary,
}: TripDetailsPageProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [removedDaysPrompt, setRemovedDaysPrompt] = useState<{
    beyond: PlacesBeyondDay;
    keptDays: TripDay[];
    resolve: (resolution: RemovedDaysResolution | null) => void;
  } | null>(null);

  // 旅程縮短且被移除的天有地點時，先讓使用者決定如何處理，再與旅程更新在同一交易內寫入
  async function saveWithRemovedDaysCheck(input: TripFormInput, existingTrip?: Trip): Promise<SaveTripResult> {
    const parsed = tripFormSchema.safeParse(input);
    if (!existingTrip || !parsed.success) return saveTrip(input, { existingTrip, repository });

    const oldDayCount = getTripDurationDays(existingTrip.startDate, existingTrip.endDate);
    const newDayCount = getTripDurationDays(parsed.data.startDate, parsed.data.endDate);
    if (newDayCount >= oldDayCount) return saveTrip(input, { existingTrip, repository });

    const beyond = await itineraryRepository.countPlacesBeyondDay(existingTrip.id, newDayCount);
    if (!beyond.placeCount) return saveTrip(input, { existingTrip, repository });

    const resolution = await new Promise<RemovedDaysResolution | null>((resolve) =>
      setRemovedDaysPrompt({
        beyond,
        keptDays: listTripDays(parsed.data.startDate, parsed.data.endDate),
        resolve,
      }),
    );
    setRemovedDaysPrompt(null);
    if (!resolution) {
      return { success: false, message: "已取消日期變更，旅程未修改。", fieldErrors: {} };
    }

    return saveTrip(input, {
      existingTrip,
      repository: {
        ...repository,
        update: (updatedTrip) => itineraryRepository.updateTripWithRemovedDays(updatedTrip, resolution),
      },
    });
  }

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
          save={saveWithRemovedDaysCheck}
        />
        {removedDaysPrompt && (
          <RemovedDaysDialog
            keptDays={removedDaysPrompt.keptDays}
            onCancel={() => removedDaysPrompt.resolve(null)}
            onResolve={(resolution) => removedDaysPrompt.resolve(resolution)}
            placeCount={removedDaysPrompt.beyond.placeCount}
            removedDayNumbers={removedDaysPrompt.beyond.dayNumbers}
          />
        )}
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
            <button
              className="inline-flex min-h-11 items-center gap-2 border border-ink bg-ink px-4 text-sm text-paper hover:bg-transparent hover:text-ink"
              onClick={onOpenItinerary}
              type="button"
            >
              <CalendarDays aria-hidden="true" className="size-4" />
              每日行程
            </button>
            <CopyTripButton onCopy={onCopy} trip={trip} />
            <button
              className="inline-flex min-h-11 items-center gap-2 border border-ink px-4 text-sm text-ink hover:bg-ink hover:text-paper"
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