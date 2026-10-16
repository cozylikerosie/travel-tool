// 解析使用者貼上的座標或電腦版 Google 地圖網址。
// 純函式、不連網；規格見 specs/002-daily-itinerary-map/contracts/location-input.md

export interface LatLng {
  lat: number;
  lng: number;
}

export type LocationParseFailure = "empty" | "short-url" | "out-of-range" | "unrecognized";

export type LocationParseResult =
  | { ok: true; coordinates: LatLng; name?: string }
  | { ok: false; reason: LocationParseFailure };

export const LOCATION_PARSE_MESSAGES: Record<Exclude<LocationParseFailure, "empty">, string> = {
  "short-url":
    "無法讀取手機分享的短網址。請在 Google 地圖長按（或在電腦上按右鍵）地點，複製畫面上的座標（例如 34.6672, 133.9354）後貼上；或改貼電腦版瀏覽器網址列中的網址。",
  "out-of-range": "座標超出範圍：緯度需在 −90 到 90、經度需在 −180 到 180 之間。",
  unrecognized:
    "無法從貼上的內容取得座標。請貼上座標（例如 34.6672, 133.9354）或電腦版 Google 地圖網址；也可以改用手動輸入名稱。",
};

const NUMBER = String.raw`[+-]?\d+(?:\.\d+)?`;
const PLAIN_COORDINATES = new RegExp(String.raw`^(${NUMBER})\s*,\s*(${NUMBER})$`);
const PLACE_COORDINATES = new RegExp(String.raw`!3d(${NUMBER})!4d(${NUMBER})`);
const CENTER_COORDINATES = new RegExp(String.raw`@(${NUMBER}),(${NUMBER}),[\d.]+z`);
const COORDINATE_PARAMS = ["q", "query", "ll", "destination"] as const;

type CoordinateMatch = { kind: "valid"; coordinates: LatLng } | { kind: "out-of-range" };

function toCoordinates(latText: string, lngText: string): CoordinateMatch {
  const lat = Number(latText);
  const lng = Number(lngText);
  if (Math.abs(lat) > 90 || Math.abs(lng) > 180) return { kind: "out-of-range" };
  return { kind: "valid", coordinates: { lat, lng } };
}

function parsePlainCoordinates(text: string): CoordinateMatch | null {
  const match = PLAIN_COORDINATES.exec(text.trim());
  return match ? toCoordinates(match[1]!, match[2]!) : null;
}

function parseUrl(text: string): URL | null {
  if (!/^https?:\/\//i.test(text)) return null;
  try {
    return new URL(text);
  } catch {
    return null;
  }
}

function isShortUrl(url: URL): boolean {
  const host = url.hostname.toLowerCase();
  if (host === "maps.app.goo.gl") return true;
  if (host === "goo.gl") return url.pathname.startsWith("/maps");
  if (host === "g.co") return url.pathname.startsWith("/kgs");
  return false;
}

function isGoogleMapsUrl(url: URL): boolean {
  return /^(www\.)?google\.[a-z.]+$/i.test(url.hostname) && url.pathname.startsWith("/maps");
}

function decodePathSegment(segment: string): string {
  try {
    return decodeURIComponent(segment.replace(/\+/g, " "));
  } catch {
    return segment.replace(/\+/g, " ");
  }
}

function findPlaceName(url: URL): string | undefined {
  const match = /^\/maps\/place\/([^/]+)/.exec(url.pathname);
  if (!match) return undefined;
  const name = decodePathSegment(match[1]!).trim();
  if (!name || PLAIN_COORDINATES.test(name)) return undefined;
  return name;
}

function findUrlCoordinates(url: URL, rawText: string): CoordinateMatch | null {
  // 地點本身的座標優先，其次才是地圖畫面中心
  const decoded = decodePathSegment(rawText);
  const place = PLACE_COORDINATES.exec(decoded);
  if (place) return toCoordinates(place[1]!, place[2]!);

  const center = CENTER_COORDINATES.exec(decoded);
  if (center) return toCoordinates(center[1]!, center[2]!);

  for (const param of COORDINATE_PARAMS) {
    const value = url.searchParams.get(param);
    const parsed = value ? parsePlainCoordinates(value) : null;
    if (parsed) return parsed;
  }
  return null;
}

export function parseLocationInput(text: string): LocationParseResult {
  const input = text.trim();
  if (!input) return { ok: false, reason: "empty" };

  const plain = parsePlainCoordinates(input);
  if (plain) {
    return plain.kind === "valid"
      ? { ok: true, coordinates: plain.coordinates }
      : { ok: false, reason: "out-of-range" };
  }

  const url = parseUrl(input);
  if (!url) return { ok: false, reason: "unrecognized" };
  if (isShortUrl(url)) return { ok: false, reason: "short-url" };
  if (!isGoogleMapsUrl(url)) return { ok: false, reason: "unrecognized" };

  const found = findUrlCoordinates(url, input);
  if (!found) return { ok: false, reason: "unrecognized" };
  if (found.kind === "out-of-range") return { ok: false, reason: "out-of-range" };

  const name = findPlaceName(url);
  return name ? { ok: true, coordinates: found.coordinates, name } : { ok: true, coordinates: found.coordinates };
}
