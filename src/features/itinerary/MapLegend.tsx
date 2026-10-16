import { lineClassName } from "./mapModel";
import { TRANSPORT_MODES, UNSET_TRANSPORT, type TransportModeDefinition } from "./transportModes";

const LEGEND_ITEMS: readonly TransportModeDefinition[] = [...TRANSPORT_MODES, UNSET_TRANSPORT];

export function MapLegend() {
  return (
    <ul
      aria-label="交通方式圖例"
      className="grid grid-cols-3 gap-x-4 gap-y-1 border border-rule bg-paper/95 px-3 py-2 text-xs text-ink"
    >
      {LEGEND_ITEMS.map((mode) => (
        <li className="flex items-center gap-2" key={mode.code}>
          <svg aria-hidden="true" className="shrink-0" height="8" width="28">
            <line
              className={lineClassName(mode.lineStyle.color)}
              fill="none"
              strokeLinecap="round"
              strokeWidth={mode.lineStyle.weight}
              x1="3"
              x2="25"
              y1="4"
              y2="4"
            />
          </svg>
          <span>{mode.label}</span>
        </li>
      ))}
    </ul>
  );
}
