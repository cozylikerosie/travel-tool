// 產生 Google Maps URLs 路線查詢連結（免金鑰）。
// 規格見 specs/002-daily-itinerary-map/contracts/google-maps-urls.md
import {
  getTransportMode,
  type TransportModeCode,
} from "../../features/itinerary/transportModes";
import type { LatLng } from "./locationInput";

export interface PlaceEndpoint {
  name: string;
  address: string;
  coordinates: LatLng | null;
}

const DIRECTIONS_BASE = "https://www.google.com/maps/dir/";

function endpointQuery(endpoint: PlaceEndpoint): string | null {
  if (endpoint.coordinates) {
    return `${endpoint.coordinates.lat},${endpoint.coordinates.lng}`;
  }
  const name = endpoint.name.trim();
  if (!name) return null;
  const address = endpoint.address.trim();
  return address ? `${name}, ${address}` : name;
}

export function buildGoogleMapsDirectionsUrl(
  origin: PlaceEndpoint,
  destination: PlaceEndpoint,
  mode: TransportModeCode | null,
): string | null {
  const originQuery = endpointQuery(origin);
  const destinationQuery = endpointQuery(destination);
  if (!originQuery || !destinationQuery) return null;

  const params = new URLSearchParams({ api: "1", origin: originQuery, destination: destinationQuery });
  const { travelmode } = getTransportMode(mode);
  if (travelmode) params.set("travelmode", travelmode);
  return `${DIRECTIONS_BASE}?${params.toString()}`;
}
