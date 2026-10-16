import { CircleAlert, MapPin } from "lucide-react";
import { useState, type FormEvent, type ReactNode } from "react";
import {
  LOCATION_PARSE_MESSAGES,
  parseLocationInput,
  type LatLng,
} from "../../shared/geo/locationInput";
import {
  deriveDepartureTime,
  deriveStayMinutes,
  placeFormSchema,
  type Place,
  type PlaceFields,
  type PlaceFormInput,
} from "./itinerarySchema";

type InputMode = "paste" | "manual";
type StayKind = PlaceFormInput["stayKind"];
type FieldErrors = Partial<Record<"name" | "arrivalTime" | "stay", string>>;

interface PlaceFormProps {
  initialPlace?: Place;
  onSubmit: (fields: PlaceFields) => Promise<void>;
  onCancel: () => void;
}

const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;

function inputClass(hasError = false): string {
  return `min-h-12 w-full border-b bg-transparent px-0 py-2 text-base text-ink outline-none transition-colors placeholder:text-muted focus:border-ink ${hasError ? "border-budget-over" : "border-rule"}`;
}

function formatCoordinates(coordinates: LatLng): string {
  return `${coordinates.lat}, ${coordinates.lng}`;
}

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <p className="mt-1 flex items-start gap-2 text-sm text-ink" role="alert">
      <CircleAlert aria-hidden="true" className="mt-1 size-4 shrink-0 text-budget-over" />
      <span>{message}</span>
    </p>
  );
}

function FieldLabel({ children }: { children: ReactNode }) {
  return <span className="font-label text-[11px] uppercase tracking-[0.15em] text-muted">{children}</span>;
}

function initialStay(place?: Place) {
  const stay = place?.stay ?? { kind: "none" as const };
  return {
    kind: stay.kind as StayKind,
    hours: stay.kind === "duration" ? String(Math.floor(stay.minutes / 60)) : "",
    minutes: stay.kind === "duration" ? String(stay.minutes % 60) : "",
    departure: stay.kind === "departure" ? stay.time : "",
  };
}

function describeDuration(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (!hours) return `停留 ${rest} 分鐘`;
  return rest ? `停留 ${hours} 小時 ${rest} 分鐘` : `停留 ${hours} 小時`;
}

export function PlaceForm({ initialPlace, onSubmit, onCancel }: PlaceFormProps) {
  const isEditing = Boolean(initialPlace);
  const title = isEditing ? "編輯地點" : "新增地點";
  const stayDefaults = initialStay(initialPlace);

  const [mode, setMode] = useState<InputMode>(
    initialPlace && !initialPlace.coordinates ? "manual" : "paste",
  );
  const [pasteText, setPasteText] = useState(
    initialPlace?.coordinates ? formatCoordinates(initialPlace.coordinates) : "",
  );
  const [coordinates, setCoordinates] = useState<LatLng | null>(initialPlace?.coordinates ?? null);
  const [parseMessage, setParseMessage] = useState("");
  const [name, setName] = useState(initialPlace?.name ?? "");
  const [address, setAddress] = useState(initialPlace?.address ?? "");
  const [arrivalTime, setArrivalTime] = useState(initialPlace?.arrivalTime ?? "");
  const [stayKind, setStayKind] = useState<StayKind>(stayDefaults.kind);
  const [stayHours, setStayHours] = useState(stayDefaults.hours);
  const [stayMinutes, setStayMinutes] = useState(stayDefaults.minutes);
  const [departureTime, setDepartureTime] = useState(stayDefaults.departure);
  const [notes, setNotes] = useState(initialPlace?.notes ?? "");
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  function handlePasteChange(value: string) {
    setPasteText(value);
    const result = parseLocationInput(value);
    if (result.ok) {
      setCoordinates(result.coordinates);
      setParseMessage("");
      if (result.name) setName((current) => current.trim() ? current : result.name!);
      return;
    }
    setCoordinates(null);
    setParseMessage(result.reason === "empty" ? "" : LOCATION_PARSE_MESSAGES[result.reason]);
  }

  function handleRemoveCoordinates() {
    setCoordinates(null);
    setPasteText("");
    setParseMessage("");
    setMode("manual");
  }

  function stayHint(): string {
    if (!TIME_PATTERN.test(arrivalTime)) return "";
    if (stayKind === "duration") {
      const total = Number(stayHours || 0) * 60 + Number(stayMinutes || 0);
      if (!Number.isInteger(total) || total < 1 || total > 1439) return "";
      const departure = deriveDepartureTime(arrivalTime, total);
      return departure.nextDay ? `預計隔天 ${departure.time} 離開` : `預計 ${departure.time} 離開`;
    }
    if (stayKind === "departure" && TIME_PATTERN.test(departureTime)) {
      const minutes = deriveStayMinutes(arrivalTime, departureTime);
      return minutes > 0 ? describeDuration(minutes) : "";
    }
    return "";
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrors({});
    setFormError("");

    const result = placeFormSchema.safeParse({
      name,
      address,
      coordinates: mode === "paste" ? coordinates : null,
      arrivalTime,
      stayKind,
      stayHours,
      stayMinutes,
      departureTime,
      notes,
    });
    if (!result.success) {
      const nextErrors: FieldErrors = {};
      for (const issue of result.error.issues) {
        const field = issue.path[0];
        const key = field === "stayHours" || field === "departureTime" ? "stay" : field;
        if (key === "name" || key === "arrivalTime" || key === "stay") {
          nextErrors[key] ??= issue.message;
        }
      }
      setErrors(nextErrors);
      return;
    }

    setIsSaving(true);
    try {
      await onSubmit(result.data);
    } catch (error) {
      setFormError(error instanceof Error && error.message ? error.message : "儲存失敗，請稍後再試。");
      setIsSaving(false);
    }
  }

  const hint = stayHint();

  return (
    <form
      aria-label={title}
      className="grid gap-6 border-t-2 border-ink bg-paper pt-5"
      noValidate
      onSubmit={handleSubmit}
    >
      <header className="grid gap-1">
        <p className="font-label text-[11px] uppercase tracking-[0.15em] text-muted">
          {isEditing ? "EDIT PLACE" : "NEW PLACE"}
        </p>
        <h3 className="font-title text-2xl text-ink">{title}</h3>
      </header>

      <fieldset className="grid gap-3">
        <legend className="sr-only">輸入方式</legend>
        <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="輸入方式">
          {(
            [
              ["paste", "貼上座標或網址"],
              ["manual", "手動輸入"],
            ] as const
          ).map(([value, label]) => (
            <label
              className={`inline-flex min-h-11 cursor-pointer items-center gap-2 border px-4 text-sm ${
                mode === value ? "border-ink text-ink" : "border-rule text-muted hover:text-ink"
              }`}
              key={value}
            >
              <input
                checked={mode === value}
                className="sr-only"
                name="place-input-mode"
                onChange={() => setMode(value)}
                type="radio"
                value={value}
              />
              {label}
            </label>
          ))}
        </div>

        {mode === "paste" && (
          <div className="grid gap-2">
            <label className="grid gap-1">
              <FieldLabel>座標或網址</FieldLabel>
              <input
                aria-label="座標或 Google 地圖網址"
                className={inputClass(Boolean(parseMessage))}
                onChange={(event) => handlePasteChange(event.target.value)}
                placeholder="34.6672, 133.9354 或 https://www.google.com/maps/place/…"
                value={pasteText}
              />
            </label>
            {coordinates && (
              <div className="flex flex-wrap items-center gap-3 text-sm text-muted">
                <MapPin aria-hidden="true" className="size-4 text-accent" />
                <span>已取得座標：{formatCoordinates(coordinates)}</span>
                {isEditing && (
                  <button
                    className="min-h-11 text-sm text-ink underline decoration-rule underline-offset-4"
                    onClick={handleRemoveCoordinates}
                    type="button"
                  >
                    移除座標
                  </button>
                )}
              </div>
            )}
            <FieldError message={parseMessage} />
          </div>
        )}
      </fieldset>

      <div className="grid gap-5 md:grid-cols-2">
        <label className="grid content-start gap-1">
          <FieldLabel>名稱</FieldLabel>
          <input
            aria-label="地點名稱"
            className={inputClass(Boolean(errors.name))}
            onChange={(event) => setName(event.target.value)}
            value={name}
          />
          <FieldError message={errors.name} />
        </label>
        <label className="grid content-start gap-1">
          <FieldLabel>地址（選填）</FieldLabel>
          <input
            aria-label="地址"
            className={inputClass()}
            onChange={(event) => setAddress(event.target.value)}
            value={address}
          />
        </label>
      </div>

      <div className="grid gap-5 md:grid-cols-2">
        <label className="grid content-start gap-1">
          <FieldLabel>抵達時間</FieldLabel>
          <input
            aria-label="抵達時間"
            className={inputClass(Boolean(errors.arrivalTime))}
            onChange={(event) => setArrivalTime(event.target.value)}
            type="time"
            value={arrivalTime}
          />
          <FieldError message={errors.arrivalTime} />
        </label>

        <fieldset className="grid content-start gap-2">
          <legend className="font-label text-[11px] uppercase tracking-[0.15em] text-muted">
            停留（選填）
          </legend>
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-ink">
            {(
              [
                ["none", "不填停留"],
                ["duration", "填停留時間"],
                ["departure", "填離開時間"],
              ] as const
            ).map(([value, label]) => (
              <label className="inline-flex min-h-11 items-center gap-2" key={value}>
                <input
                  checked={stayKind === value}
                  className="accent-ink"
                  name="place-stay-kind"
                  onChange={() => setStayKind(value)}
                  type="radio"
                  value={value}
                />
                {label}
              </label>
            ))}
          </div>
          {stayKind === "duration" && (
            <div className="flex items-end gap-3">
              <label className="grid gap-1">
                <span className="text-xs text-muted">小時</span>
                <input
                  aria-label="停留小時"
                  className={`${inputClass(Boolean(errors.stay))} w-20`}
                  inputMode="numeric"
                  onChange={(event) => setStayHours(event.target.value)}
                  value={stayHours}
                />
              </label>
              <label className="grid gap-1">
                <span className="text-xs text-muted">分鐘</span>
                <input
                  aria-label="停留分鐘"
                  className={`${inputClass(Boolean(errors.stay))} w-20`}
                  inputMode="numeric"
                  onChange={(event) => setStayMinutes(event.target.value)}
                  value={stayMinutes}
                />
              </label>
            </div>
          )}
          {stayKind === "departure" && (
            <input
              aria-label="離開時間"
              className={inputClass(Boolean(errors.stay))}
              onChange={(event) => setDepartureTime(event.target.value)}
              type="time"
              value={departureTime}
            />
          )}
          {hint && <p className="text-sm text-muted">{hint}</p>}
          <FieldError message={errors.stay} />
        </fieldset>
      </div>

      <label className="grid gap-1">
        <FieldLabel>備註（選填）</FieldLabel>
        <textarea
          aria-label="備註"
          className={`${inputClass()} min-h-20 resize-y`}
          onChange={(event) => setNotes(event.target.value)}
          value={notes}
        />
      </label>

      {formError && <FieldError message={formError} />}

      <div className="flex justify-end gap-3 border-t border-rule pt-5">
        <button
          className="min-h-11 border border-rule px-5 text-sm text-ink hover:border-ink"
          disabled={isSaving}
          onClick={onCancel}
          type="button"
        >
          取消
        </button>
        <button
          className="min-h-11 border border-ink bg-ink px-5 text-sm text-paper hover:bg-transparent hover:text-ink disabled:opacity-60"
          disabled={isSaving}
          type="submit"
        >
          {isSaving ? "儲存中…" : isEditing ? "儲存變更" : "儲存地點"}
        </button>
      </div>
    </form>
  );
}
