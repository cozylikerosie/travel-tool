import { CalendarDays } from "lucide-react";
import { useState } from "react";
import type { TripDay } from "../../shared/dates/tripDates";

interface MovePlaceDialogProps {
  placeName: string;
  days: TripDay[];
  currentDayNumber: number;
  onCancel: () => void;
  onConfirm: (targetDayNumber: number) => Promise<void>;
}

export function MovePlaceDialog({ placeName, days, currentDayNumber, onCancel, onConfirm }: MovePlaceDialogProps) {
  const targets = days.filter((day) => day.dayNumber !== currentDayNumber);
  const [targetDayNumber, setTargetDayNumber] = useState(targets[0]?.dayNumber ?? currentDayNumber);
  const [isMoving, setIsMoving] = useState(false);
  const [error, setError] = useState("");

  async function handleConfirm() {
    setIsMoving(true);
    setError("");
    try {
      await onConfirm(targetDayNumber);
    } catch {
      setError("移動失敗，請稍後再試。");
      setIsMoving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[2000] grid place-items-center bg-ink/40 p-5">
      <section
        aria-labelledby="move-place-title"
        aria-modal="true"
        className="grid w-full max-w-md gap-5 border border-rule bg-paper p-6 md:p-8"
        role="dialog"
      >
        <div className="flex items-start gap-4">
          <CalendarDays aria-hidden="true" className="mt-1 size-5 shrink-0 text-accent" />
          <div className="grid gap-2">
            <h2 className="font-title text-2xl text-ink" id="move-place-title">
              移到其他天
            </h2>
            <p className="text-sm text-muted">
              將「{placeName}」移到另一天。移入後依抵達時間排序，前後的交通方式會重設為未設定。
            </p>
          </div>
        </div>
        <label className="grid gap-1">
          <span className="font-label text-[11px] uppercase tracking-[0.15em] text-muted">目標日</span>
          <select
            aria-label="目標日"
            className="min-h-12 border-b border-rule bg-transparent text-base text-ink outline-none focus:border-ink"
            onChange={(event) => setTargetDayNumber(Number(event.target.value))}
            value={targetDayNumber}
          >
            {targets.map((day) => (
              <option key={day.dayNumber} value={day.dayNumber}>
                {day.label}
              </option>
            ))}
          </select>
        </label>
        {error && <p className="text-sm text-ink" role="alert">{error}</p>}
        <div className="flex justify-end gap-3 border-t border-rule pt-5">
          <button
            className="min-h-11 border border-rule px-5 text-sm text-ink hover:border-ink"
            disabled={isMoving}
            onClick={onCancel}
            type="button"
          >
            取消
          </button>
          <button
            className="min-h-11 border border-ink bg-ink px-5 text-sm text-paper hover:bg-transparent hover:text-ink disabled:opacity-60"
            disabled={isMoving || !targets.length}
            onClick={handleConfirm}
            type="button"
          >
            {isMoving ? "移動中…" : "移動"}
          </button>
        </div>
      </section>
    </div>
  );
}
