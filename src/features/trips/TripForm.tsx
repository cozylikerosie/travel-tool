import { CircleAlert, Plus, X } from "lucide-react";
import { useState, type FormEvent } from "react";
import { formatMoneyInput } from "../../shared/money/budget";
import { CURRENCIES, formatCurrencyLabel } from "../../shared/money/currencies";
import {
  saveTrip,
  type SaveTripResult,
  type TripFieldErrors,
} from "./saveTrip";
import { SortableDestinations } from "./SortableDestinations";
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

function FormSection({
  number,
  label,
  title,
  children,
}: {
  number: string;
  label: string;
  title: string;
  children: React.ReactNode;
}) {
  const headingId = `trip-form-section-${number}`;
  return (
    <section
      aria-labelledby={headingId}
      className="grid gap-5 border-t-2 border-ink pt-5 md:grid-cols-[minmax(180px,0.7fr)_minmax(0,1.3fr)] md:gap-10 md:pt-6"
    >
      <header className="flex items-baseline gap-4 md:items-start">
        <span className="font-display text-2xl leading-none text-accent">{number}</span>
        <div className="grid gap-1">
          <p className="font-label text-[11px] uppercase tracking-[0.15em] text-muted">
            {label}
          </p>
          <h2 className="font-title text-xl leading-snug text-ink" id={headingId}>{title}</h2>
        </div>
      </header>
      <div className="grid min-w-0 content-start gap-5">{children}</div>
    </section>
  );
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
    <form noValidate onSubmit={handleSubmit} className="grid gap-8 md:gap-12">
      <FormSection number="01" label="BASICS" title="基本資訊">
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
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="grid gap-1">
            <span className="text-sm text-muted">出發日期</span>
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
            <span className="text-sm text-muted">回程日期</span>
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
      </FormSection>

      <FormSection number="02" label="DESTINATIONS" title="目的地">
        <div className="grid gap-3">
          <div className="flex items-center justify-between gap-4">
            <p className="text-sm text-muted">拖曳把手可調整目的地順序</p>
            <button
              className="inline-flex min-h-11 shrink-0 items-center gap-2 px-2 text-sm text-ink underline decoration-rule underline-offset-4 hover:decoration-ink"
              onClick={() => setDestinations([...destinations, ""])}
              type="button"
            >
              <Plus aria-hidden="true" className="size-4" />新增目的地
            </button>
          </div>
          <SortableDestinations
            error={fieldErrors.destinations}
            items={destinations}
            onChange={setDestinations}
            onRemove={(index) => setDestinations(destinations.filter((_, itemIndex) => itemIndex !== index))}
          />
        </div>
      </FormSection>

      <FormSection number="03" label="BUDGET" title="預算">
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
              {CURRENCIES.map(({ code }) => (
                <option key={code} value={code}>{formatCurrencyLabel(code)}</option>
              ))}
            </select>
            <FieldError id="budgetCurrency-error" message={fieldErrors.budgetCurrency} />
          </label>
        </div>
      </FormSection>

      <FormSection number="04" label="COMPANIONS" title="同行者">
        <div className="grid gap-3">
          <div className="flex items-center justify-between gap-4">
            <p className="text-sm text-muted">選填</p>
            <button
              className="inline-flex min-h-11 shrink-0 items-center gap-2 px-2 text-sm text-ink underline decoration-rule underline-offset-4 hover:decoration-ink"
              onClick={() => setCompanions([...companions, ""])}
              type="button"
            >
              <Plus aria-hidden="true" className="size-4" />新增同行者
            </button>
          </div>
          {companions.map((companion, index) => (
            <div className="flex items-start gap-3 border-b border-rule pt-3 transition-colors focus-within:border-ink" key={`companion-${index}`}>
              <label className="grid min-w-0 flex-1 gap-1">
                <span className="text-xs text-muted">同行者 {index + 1}</span>
                <input
                  className="min-h-12 w-full bg-transparent px-0 py-2 text-base text-ink outline-none placeholder:text-muted"
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
      </FormSection>

      <FormSection number="05" label="NOTES" title="備註">
        <label className="grid gap-1">
          <span className="sr-only">備註</span>
          <textarea
            className="min-h-24 resize-y border-b border-rule bg-transparent px-0 py-2 text-base text-ink outline-none focus:border-ink"
            name="notes"
            aria-label="備註"
            defaultValue={initialTrip?.notes ?? initialValues?.notes ?? ""}
            rows={3}
          />
        </label>
      </FormSection>

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
          className="min-h-11 border border-ink bg-ink px-6 text-sm text-paper transition-colors hover:bg-transparent hover:text-ink"
          type="submit"
        >
          {initialTrip ? "儲存修改" : "建立旅程"}
        </button>
      </div>
    </form>
  );
}