import { Copy } from "lucide-react";
import { formatMoneyInput } from "../../shared/money/budget";
import type { Trip, TripFormInput } from "./tripSchema";

interface CopyTripButtonProps {
  trip: Trip;
  onCopy: (initialValues: TripFormInput) => void;
}

export function CopyTripButton({ trip, onCopy }: CopyTripButtonProps) {
  function handleCopy() {
    onCopy({
      name: trip.name,
      destinations: [...trip.destinations],
      startDate: trip.startDate,
      endDate: trip.endDate,
      budgetAmount:
        trip.budgetAmountMinor !== null && trip.budgetCurrency
          ? formatMoneyInput(trip.budgetAmountMinor, trip.budgetCurrency)
          : "",
      budgetCurrency: trip.budgetCurrency ?? "",
      companions: [...trip.companions],
      notes: trip.notes,
    });
  }

  return (
    <button
      className="inline-flex min-h-11 items-center gap-2 border border-rule px-4 text-sm text-ink hover:border-ink"
      onClick={handleCopy}
      type="button"
    >
      <Copy aria-hidden="true" className="size-4" />
      複製旅程
    </button>
  );
}