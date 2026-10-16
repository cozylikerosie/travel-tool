import { AlertTriangle } from "lucide-react";
import { useState } from "react";

interface DeleteTripDialogProps {
  tripName: string;
  onCancel: () => void;
  onConfirm: () => Promise<void>;
}

export function DeleteTripDialog({ tripName, onCancel, onConfirm }: DeleteTripDialogProps) {
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState("");

  async function handleConfirm() {
    setIsDeleting(true);
    setError("");
    try {
      await onConfirm();
    } catch {
      setError("刪除失敗，請稍後再試。");
      setIsDeleting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-ink/40 p-5">
      <section
        aria-describedby="delete-trip-description"
        aria-labelledby="delete-trip-title"
        aria-modal="true"
        className="grid w-full max-w-md gap-5 border border-rule bg-paper p-6 md:p-8"
        role="dialog"
      >
        <div className="flex items-start gap-4">
          <AlertTriangle aria-hidden="true" className="mt-1 size-5 shrink-0 text-budget-over" />
          <div className="grid gap-2">
            <h2 className="font-title text-2xl text-ink" id="delete-trip-title">
              刪除旅程
            </h2>
            <p className="text-sm text-muted" id="delete-trip-description">
              確定要刪除「{tripName}」嗎？此操作無法復原。
            </p>
          </div>
        </div>
        {error && <p className="text-sm text-ink" role="alert">{error}</p>}
        <div className="flex justify-end gap-3 border-t border-rule pt-5">
          <button
            className="min-h-11 border border-rule px-5 text-sm text-ink hover:border-ink"
            disabled={isDeleting}
            onClick={onCancel}
            type="button"
          >
            取消
          </button>
          <button
            className="min-h-11 border border-ink bg-ink px-5 text-sm text-white hover:bg-transparent hover:text-ink disabled:opacity-60"
            disabled={isDeleting}
            onClick={handleConfirm}
            type="button"
          >
            {isDeleting ? "刪除中…" : "確認刪除"}
          </button>
        </div>
      </section>
    </div>
  );
}