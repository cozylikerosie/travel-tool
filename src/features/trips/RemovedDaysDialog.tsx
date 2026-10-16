import { AlertTriangle } from "lucide-react";
import { useState } from "react";
import type { RemovedDaysResolution } from "../../data/itineraryRepository";
import type { TripDay } from "../../shared/dates/tripDates";

interface RemovedDaysDialogProps {
  removedDayNumbers: number[];
  placeCount: number;
  keptDays: TripDay[];
  onCancel: () => void;
  onResolve: (resolution: RemovedDaysResolution) => void;
}

export function RemovedDaysDialog({
  removedDayNumbers,
  placeCount,
  keptDays,
  onCancel,
  onResolve,
}: RemovedDaysDialogProps) {
  const [targetDayNumber, setTargetDayNumber] = useState(keptDays.at(-1)?.dayNumber ?? 1);
  const removedLabel = removedDayNumbers.map((dayNumber) => `Day ${dayNumber}`).join("、");

  return (
    <div className="fixed inset-0 z-[2000] grid place-items-center bg-ink/40 p-5">
      <section
        aria-describedby="removed-days-description"
        aria-labelledby="removed-days-title"
        aria-modal="true"
        className="grid w-full max-w-lg gap-5 border border-rule bg-paper p-6 md:p-8"
        role="dialog"
      >
        <div className="flex items-start gap-4">
          <AlertTriangle aria-hidden="true" className="mt-1 size-5 shrink-0 text-budget-near" />
          <div className="grid gap-2">
            <h2 className="font-title text-2xl text-ink" id="removed-days-title">
              旅程天數將減少
            </h2>
            <p className="text-sm text-muted" id="removed-days-description">
              新的日期會移除 {removedLabel}，這些天共有 {placeCount} 個地點。請選擇要刪除這些地點，或移到保留的某一天。
            </p>
          </div>
        </div>

        <div className="grid gap-3 border-t border-rule pt-5">
          <label className="grid gap-1">
            <span className="font-label text-[11px] uppercase tracking-[0.15em] text-muted">移到哪一天</span>
            <select
              aria-label="移到哪一天"
              className="min-h-12 border-b border-rule bg-transparent text-base text-ink outline-none focus:border-ink"
              onChange={(event) => setTargetDayNumber(Number(event.target.value))}
              value={targetDayNumber}
            >
              {keptDays.map((day) => (
                <option key={day.dayNumber} value={day.dayNumber}>
                  {day.label}
                </option>
              ))}
            </select>
          </label>
          <button
            className="min-h-11 border border-ink bg-ink px-5 text-sm text-paper hover:bg-transparent hover:text-ink"
            onClick={() => onResolve({ action: "move", targetDayNumber })}
            type="button"
          >
            移到 Day {targetDayNumber}
          </button>
        </div>

        <div className="flex flex-wrap justify-end gap-3 border-t border-rule pt-5">
          <button
            autoFocus
            className="min-h-11 border border-rule px-5 text-sm text-ink hover:border-ink"
            onClick={onCancel}
            type="button"
          >
            取消
          </button>
          <button
            className="min-h-11 px-5 text-sm text-budget-over underline decoration-rule underline-offset-4"
            onClick={() => onResolve({ action: "delete" })}
            type="button"
          >
            刪除這些地點
          </button>
        </div>
      </section>
    </div>
  );
}
