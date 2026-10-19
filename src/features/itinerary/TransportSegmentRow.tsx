import { ExternalLink } from "lucide-react";
import { buildGoogleMapsDirectionsUrl } from "../../shared/geo/googleMapsUrls";
import type { Place } from "./itinerarySchema";
import { TRANSPORT_MODES, UNSET_TRANSPORT, type TransportModeCode } from "./transportModes";

interface TransportSegmentRowProps {
  from: Place;
  to: Place;
  mode: TransportModeCode | null;
  onChange: (mode: TransportModeCode | null) => void;
}

function displayName(place: Place): string {
  return place.name || "未命名地點";
}

export function TransportSegmentRow({ from, to, mode, onChange }: TransportSegmentRowProps) {
  const leg = `${displayName(from)} → ${displayName(to)}`;
  const href = buildGoogleMapsDirectionsUrl(from, to, mode);

  return (
    <div
      aria-label={`移動：${leg}`}
      className="ml-[5.75rem] flex flex-wrap items-center gap-x-4 gap-y-2 border-l border-dashed border-rule py-3 pl-4"
      role="group"
    >
      <label className="flex items-center gap-2">
        <span className="font-label text-[11px] uppercase tracking-[0.15em] text-muted">MOVE</span>
        <select
          aria-label={`交通方式：${leg}`}
          className="min-h-11 border-b border-rule bg-transparent pr-2 text-sm text-ink outline-none focus:border-ink"
          onChange={(event) =>
            onChange(event.target.value ? (event.target.value as TransportModeCode) : null)
          }
          value={mode ?? ""}
        >
          <option value="">{UNSET_TRANSPORT.label}</option>
          {TRANSPORT_MODES.map((option) => (
            <option key={option.code} value={option.code}>
              {option.label}
            </option>
          ))}
        </select>
      </label>
      {(!from.coordinates || !to.coordinates) && (
        <span className="basis-full text-xs text-muted">一端沒有座標，地圖上以灰線連接前後地點</span>
      )}
      {href && (
        <a
          aria-label={`在 Google 地圖開啟：${leg}`}
          className="inline-flex min-h-11 items-center gap-1.5 text-sm text-muted underline decoration-rule underline-offset-4 hover:text-ink"
          href={href}
          rel="noopener noreferrer"
          target="_blank"
        >
          在 Google 地圖開啟
          <ExternalLink aria-hidden="true" className="size-3.5" />
        </a>
      )}
    </div>
  );
}
