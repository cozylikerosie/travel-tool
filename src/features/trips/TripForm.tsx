import { CircleAlert, Plus, X } from "lucide-react";
import { useState, type FormEvent } from "react";
import { formatMoneyInput } from "../../shared/money/budget";
import {
  saveTrip,
  type SaveTripResult,
  type TripFieldErrors,
} from "./saveTrip";
import type { Trip, TripFormInput } from "./tripSchema";

interface TripFormProps {
  initialTrip?: Trip;
  initialValues?: TripFormInput;
  onSaved?: (trip: Trip) => void;
  onCancel?: () => void;
  save?: (
    formInput: TripFormInput,
    existingTrip?: Trip,
  ) => Promise<SaveTripResult>;
}

function FieldError({ message, id }: { message?: string; id: string }) {
  if (!message) return null;

  return (
    <p id={id} className="mt-1 flex items-start gap-2 text-sm text-ink" role="alert">
      <CircleAlert aria-hidden="true" className="mt-1 size-4 shrink-0 text-budget-over" />
      <span>{message}</span>
    </p>
  );
}

function inputClass(hasError: boolean): string {
  return `min-h-12 w-full border-b bg-transparent px-0 py-2 text-base text-ink outline-none transition-colors placeholder:text-muted focus:border-ink ${hasError ? "border-budget-over" : "border-rule"}`;
}

function formFieldError(errors: TripFieldErrors, field: keyof TripFormInput) {
  return errors[field];
}

export function TripForm({ initialTrip, initialValues, onSaved, onCancel, save }: TripFormProps) {
  const [destinations, setDestinations] = useState<string[]>(
    initialTrip?.destinations ?? initialValues?.destinations ?? [""],
  );
  const [companions, setCompanions] = useState<string[]>(
    initialTrip?.companions ?? initialValues?.companions ?? [],
  );
  const [budgetAmount, setBudgetAmount] = useState(() => {
    if (initialValues) return initialValues.budgetAmount ?? "";
    if (
      initialTrip?.budgetAmountMinor === null ||
      initialTrip?.budgetAmountMinor === undefined ||
      !initialTrip.budgetCurrency
    ) {
      return "";
    }
    return formatMoneyInput(
      initialTrip.budgetAmountMinor,
      initialTrip.budgetCurrency,
    );
  });
  const [budgetCurrency, setBudgetCurrency] = useState<TripFormInput["budgetCurrency"]>(
    initialTrip?.budgetCurrency ?? initialValues?.budgetCurrency ?? "",
  );
  const [fieldErrors, setFieldErrors] = useState<TripFieldErrors>({});
  const [formMessage, setFormMessage] = useState("");
  const saveAction = save ?? ((input, existing) => saveTrip(input, { existingTrip: existing }));

  function updateArrayValue(
    values: string[],
    setValues: (next: string[]) => void,
    index: number,
    value: string,
  ) {
    setValues(values.map((current, currentIndex) => currentIndex === index ? value : current));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const formInput: TripFormInput = {
      name: String(formData.get("name") ?? ""),
      destinations,
      startDate: String(formData.get("startDate") ?? ""),
      endDate: String(formData.get("endDate") ?? ""),
      budgetAmount,
      budgetCurrency,
      companions,
      notes: String(formData.get("notes") ?? ""),
    };

    setFieldErrors({});
    setFormMessage("");
    const result = await saveAction(formInput, initialTrip);
    if (!result.success) {
      setFieldErrors(result.fieldErrors);
      setFormMessage(result.message);
      return;
    }

    setFormMessage("旅程已儲存");
    onSaved?.(result.trip);
  }

  return (
    <form noValidate onSubmit={handleSubmit} className="grid gap-8">
      <div className="grid gap-6 md:grid-cols-2">
        <label className="grid content-start gap-1">
          <span className="text-sm text-muted">旅程名稱</span>
          <input
            autoComplete="off"
            className={inputClass(Boolean(formFieldError(fieldErrors, "name")))}
            name="name"
            aria-invalid={Boolean(fieldErrors.name)}
            aria-describedby={fieldErrors.name ? "name-error" : undefined}
            defaultValue={initialTrip?.name ?? initialValues?.name ?? ""}
          />
          <FieldError id="name-error" message={fieldErrors.name} />
        </label>

        <div className="grid content-start gap-1">
          <span className="text-sm text-muted">日期</span>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="grid gap-1">
              <span className="text-xs text-muted">出發日期</span>
              <input
                className={inputClass(Boolean(fieldErrors.startDate))}
                name="startDate"
                type="date"
                aria-label="出發日期"
                aria-invalid={Boolean(fieldErrors.startDate)}
                aria-describedby={fieldErrors.startDate ? "startDate-error" : undefined}
                defaultValue={initialTrip?.startDate ?? initialValues?.startDate ?? ""}
              />
              <FieldError id="startDate-error" message={fieldErrors.startDate} />
            </label>
            <label className="grid gap-1">
              <span className="text-xs text-muted">回程日期</span>
              <input
                className={inputClass(Boolean(fieldErrors.endDate))}
                name="endDate"
                type="date"
                aria-label="回程日期"
                aria-invalid={Boolean(fieldErrors.endDate)}
                aria-describedby={fieldErrors.endDate ? "endDate-error" : undefined}
                defaultValue={initialTrip?.endDate ?? initialValues?.endDate ?? ""}
              />
              <FieldError id="endDate-error" message={fieldErrors.endDate} />
            </label>
          </div>
        </div>
      </div>

      <fieldset className="grid gap-3 border-0 border-t border-rule p-0 pt-5">
        <legend className="sr-only">目的地</legend>
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted">目的地</p>
          <button
            className="inline-flex min-h-11 items-center gap-2 px-2 text-sm text-ink underline decoration-rule underline-offset-4 hover:decoration-ink"
            onClick={() => setDestinations([...destinations, ""])}
            type="button"
          >
            <Plus aria-hidden="true" className="size-4" />新增目的地
          </button>
        </div>
        {destinations.map((destination, index) => {
          const error = index === 0 ? fieldErrors.destinations : undefined;
          return (
            <div className="flex items-start gap-3" key={`destination-${index}`}>
              <label className="grid min-w-0 flex-1 gap-1">
                <span className="text-xs text-muted">目的地 {index + 1}</span>
                <input
                  className={inputClass(Boolean(error))}
                  aria-label={`目的地 ${index + 1}`}
                  aria-invalid={Boolean(error)}
                  aria-describedby={error ? "destinations-error" : undefined}
                  value={destination}
                  onChange={(event) => updateArrayValue(destinations, setDestinations, index, event.target.value)}
                />
                {index === 0 && <FieldError id="destinations-error" message={error} />}
              </label>
              {destinations.length > 1 && (
                <button
                  aria-label={`移除目的地 ${index + 1}`}
                  className="mt-5 grid size-11 shrink-0 place-items-center text-muted hover:text-ink"
                  onClick={() => setDestinations(destinations.filter((_, itemIndex) => itemIndex !== index))}
                  type="button"
                >
                  <X aria-hidden="true" className="size-4" />
                </button>
              )}
            </div>
          );
        })}
      </fieldset>

      <div className="grid gap-8 border-t border-rule pt-5 md:grid-cols-2">
        <fieldset className="grid content-start gap-3 border-0 p-0">
          <legend className="sr-only">預算</legend>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="grid content-start gap-1">
              <span className="text-sm text-muted">總預算</span>
              <input
                className={inputClass(Boolean(fieldErrors.budgetAmount))}
                inputMode="decimal"
                name="budgetAmount"
                aria-label="總預算"
                aria-invalid={Boolean(fieldErrors.budgetAmount)}
                aria-describedby={fieldErrors.budgetAmount ? "budgetAmount-error" : undefined}
                placeholder="選填"
                value={budgetAmount}
                onChange={(event) => setBudgetAmount(event.target.value)}
              />
              <FieldError id="budgetAmount-error" message={fieldErrors.budgetAmount} />
            </label>
            <label className="grid content-start gap-1">
              <span className="text-sm text-muted">預算幣別</span>
              <select
                className={inputClass(Boolean(fieldErrors.budgetCurrency))}
                aria-label="預算幣別"
                aria-invalid={Boolean(fieldErrors.budgetCurrency)}
                aria-describedby={fieldErrors.budgetCurrency ? "budgetCurrency-error" : undefined}
                value={budgetCurrency}
                onChange={(event) => setBudgetCurrency(event.target.value as TripFormInput["budgetCurrency"])}
              >
                <option value="">選擇幣別</option>
                <option value="TWD">新台幣 TWD</option>
                <option value="JPY">日圓 JPY</option>
              </select>
              <FieldError id="budgetCurrency-error" message={fieldErrors.budgetCurrency} />
            </label>
          </div>
        </fieldset>

        <div className="grid gap-3">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted">同行者</p>
            <button
              className="inline-flex min-h-11 items-center gap-2 px-2 text-sm text-ink underline decoration-rule underline-offset-4 hover:decoration-ink"
              onClick={() => setCompanions([...companions, ""])}
              type="button"
            >
              <Plus aria-hidden="true" className="size-4" />新增同行者
            </button>
          </div>
          {companions.map((companion, index) => (
            <div className="flex items-start gap-3" key={`companion-${index}`}>
              <label className="grid min-w-0 flex-1 gap-1">
                <span className="text-xs text-muted">同行者 {index + 1}</span>
                <input
                  className={inputClass(false)}
                  aria-label={`同行者 ${index + 1}`}
                  value={companion}
                  onChange={(event) => updateArrayValue(companions, setCompanions, index, event.target.value)}
                />
              </label>
              <button
                aria-label={`移除同行者 ${index + 1}`}
                className="mt-5 grid size-11 shrink-0 place-items-center text-muted hover:text-ink"
                onClick={() => setCompanions(companions.filter((_, itemIndex) => itemIndex !== index))}
                type="button"
              >
                <X aria-hidden="true" className="size-4" />
              </button>
            </div>
          ))}
        </div>
      </div>

      <label className="grid gap-1 border-t border-rule pt-5">
        <span className="text-sm text-muted">備註</span>
        <textarea
          className="min-h-24 resize-y border-b border-rule bg-transparent px-0 py-2 text-base text-ink outline-none focus:border-ink"
          name="notes"
          aria-label="備註"
          defaultValue={initialTrip?.notes ?? initialValues?.notes ?? ""}
          rows={3}
        />
      </label>

      {formMessage && (
        <p
          className="border-l-2 border-accent py-1 pl-3 text-sm text-ink"
          role="alert"
        >
          {formMessage}
        </p>
      )}

      <div className="flex flex-wrap justify-end gap-3 border-t border-rule pt-5">
        {onCancel && (
          <button
            className="min-h-11 border border-rule px-5 text-sm text-ink hover:border-ink"
            onClick={onCancel}
            type="button"
          >
            取消
          </button>
        )}
        <button
          className="min-h-11 border border-ink bg-ink px-6 text-sm text-white transition-colors hover:bg-transparent hover:text-ink"
          type="submit"
        >
          {initialTrip ? "儲存修改" : "建立旅程"}
        </button>
      </div>
    </form>
  );
}