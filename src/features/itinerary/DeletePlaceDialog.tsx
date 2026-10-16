import { AlertTriangle } from "lucide-react";
import { useState } from "react";

interface DeletePlaceDialogProps {
  placeName: string;
  onCancel: () => void;
  onConfirm: () => Promise<void>;
}

export function DeletePlaceDialog({ placeName, onCancel, onConfirm }: DeletePlaceDialogProps) {
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
    <div className="fixed inset-0 z-[2000] grid place-items-center bg-ink/40 p-5">
      <section
        aria-describedby="delete-place-description"
        aria-labelledby="delete-place-title"
        aria-modal="true"
        className="grid w-full max-w-md gap-5 border border-rule bg-paper p-6 md:p-8"
        role="dialog"
      >
        <div className="flex items-start gap-4">
          <AlertTriangle aria-hidden="true" className="mt-1 size-5 shrink-0 text-budget-over" />
          <div className="grid gap-2">
            <h2 className="font-title text-2xl text-ink" id="delete-place-title">
              刪除地點
            </h2>
            <p className="text-sm text-muted" id="delete-place-description">
              確定要刪除「{placeName}」嗎？刪除後無法復原，前後地點之間的交通方式會重設為未設定。
            </p>
          </div>
        </div>
        {error && <p className="text-sm text-ink" role="alert">{error}</p>}
        <div className="flex justify-end gap-3 border-t border-rule pt-5">
          <button
            autoFocus
            className="min-h-11 border border-rule px-5 text-sm text-ink hover:border-ink"
            disabled={isDeleting}
            onClick={onCancel}
            type="button"
          >
            取消
          </button>
          <button
            className="min-h-11 border border-ink bg-ink px-5 text-sm text-paper hover:bg-transparent hover:text-ink disabled:opacity-60"
            disabled={isDeleting}
            onClick={handleConfirm}
            type="button"
          >
            {isDeleting ? "刪除中…" : "刪除地點"}
          </button>
        </div>
      </section>
    </div>
  );
}
