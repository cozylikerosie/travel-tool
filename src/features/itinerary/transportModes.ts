// 交通方式的單一來源：選單、時間軸、地圖線條、圖例與 Google 地圖連結都讀取這份常數。

export type GoogleTravelMode = "transit" | "walking" | "driving";
// 每種交通方式一種路線色（實線），色碼定義在 tailwind.css 的 --color-route-* 變數，深色模式另有較亮版本
export type LineColor = "rail" | "bus" | "ferry" | "taxi" | "walk" | "drive" | "flight" | "other" | "unset";

export interface LineStyle {
  color: LineColor;
  weight: number;
}

export interface TransportModeDefinition<Code extends string = string> {
  code: Code;
  label: string;
  travelmode: GoogleTravelMode | null;
  lineStyle: LineStyle;
}

export const TRANSPORT_MODES = [
  {
    code: "rail",
    label: "JR／電車",
    travelmode: "transit",
    lineStyle: { color: "rail", weight: 4 },
  },
  {
    code: "bus",
    label: "巴士",
    travelmode: "transit",
    lineStyle: { color: "bus", weight: 4 },
  },
  {
    code: "ferry",
    label: "渡輪",
    travelmode: "transit",
    lineStyle: { color: "ferry", weight: 4 },
  },
  {
    code: "taxi",
    label: "計程車",
    travelmode: "driving",
    lineStyle: { color: "taxi", weight: 4 },
  },
  {
    code: "walk",
    label: "步行",
    travelmode: "walking",
    lineStyle: { color: "walk", weight: 4 },
  },
  {
    code: "drive",
    label: "自駕",
    travelmode: "driving",
    lineStyle: { color: "drive", weight: 4 },
  },
  {
    code: "flight",
    label: "飛機",
    travelmode: null,
    lineStyle: { color: "flight", weight: 4 },
  },
  {
    code: "other",
    label: "其他",
    travelmode: null,
    lineStyle: { color: "other", weight: 4 },
  },
] as const satisfies readonly TransportModeDefinition[];

export type TransportModeCode = (typeof TRANSPORT_MODES)[number]["code"];

export const TRANSPORT_MODE_CODES = TRANSPORT_MODES.map((mode) => mode.code) as [
  TransportModeCode,
  ...TransportModeCode[],
];

export const UNSET_TRANSPORT: TransportModeDefinition<"unset"> = {
  code: "unset",
  label: "未設定",
  travelmode: null,
  lineStyle: { color: "unset", weight: 3 },
};

export function getTransportMode(
  code: TransportModeCode | null,
): TransportModeDefinition<TransportModeCode | "unset"> {
  if (code === null) return UNSET_TRANSPORT;
  return TRANSPORT_MODES.find((mode) => mode.code === code) ?? UNSET_TRANSPORT;
}
