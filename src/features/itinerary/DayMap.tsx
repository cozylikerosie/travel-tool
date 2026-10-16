import "leaflet/dist/leaflet.css";
import { useEffect, useMemo, useState } from "react";
import { MapContainer, Marker, Polyline, TileLayer, useMap } from "react-leaflet";
import type { Place, TransportSegment } from "./itinerarySchema";
import { MapLegend } from "./MapLegend";
import {
  buildMapLines,
  buildMapMarkers,
  getMapViewport,
  resolveTileTheme,
  type MapMarker,
  type MapViewport,
} from "./mapModel";
import { createNumberedMarkerIcon } from "./markerIcon";

interface DayMapProps {
  dayPlaces: Place[];
  tripPlaces: Place[];
  segments: TransportSegment[];
  selectedPlaceId: string | null;
  onSelectPlace: (placeId: string) => void;
}

// Esri 灰階底圖（免金鑰）：底圖與地名分成兩層，深色模式使用對應的深灰版
const ESRI_CANVAS = "https://server.arcgisonline.com/ArcGIS/rest/services/Canvas";
const TILE_LAYERS = {
  light: {
    base: `${ESRI_CANVAS}/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}`,
    labels: `${ESRI_CANVAS}/World_Light_Gray_Reference/MapServer/tile/{z}/{y}/{x}`,
  },
  dark: {
    base: `${ESRI_CANVAS}/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}`,
    labels: `${ESRI_CANVAS}/World_Dark_Gray_Reference/MapServer/tile/{z}/{y}/{x}`,
  },
} as const;
const MAX_NATIVE_ZOOM = 16;
const MAX_ZOOM = 18;

const ATTRIBUTION =
  'Tiles © <a href="https://www.esri.com/">Esri</a> — Esri, HERE, Garmin, © <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors, and the GIS user community';

const DARK_QUERY = "(prefers-color-scheme: dark)";

function readTileTheme() {
  return resolveTileTheme(
    document.documentElement.getAttribute("data-theme"),
    window.matchMedia(DARK_QUERY).matches,
  );
}

function useTileTheme() {
  const [theme, setTheme] = useState(readTileTheme);

  useEffect(() => {
    const update = () => setTheme(readTileTheme());
    const media = window.matchMedia(DARK_QUERY);
    media.addEventListener?.("change", update);
    const observer = new MutationObserver(update);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
    return () => {
      media.removeEventListener?.("change", update);
      observer.disconnect();
    };
  }, []);

  return theme;
}

function ViewportController({
  viewport,
  selectedMarker,
}: {
  viewport: MapViewport;
  selectedMarker: MapMarker | undefined;
}) {
  const map = useMap();
  const viewportKey = JSON.stringify(viewport);

  useEffect(() => {
    if (viewport.kind === "bounds") map.fitBounds(viewport.bounds, { padding: [40, 40] });
    else map.setView(viewport.center, viewport.zoom);
    // 以 viewportKey 比對內容；viewport 物件每次渲染都是新的
  }, [map, viewportKey]);

  const selectedPosition = selectedMarker?.position;
  const selectedKey = selectedPosition ? selectedPosition.join(",") : null;
  useEffect(() => {
    if (!selectedPosition) return;
    if (!map.getBounds().contains(selectedPosition)) map.panTo(selectedPosition);
  }, [map, selectedKey]);

  return null;
}

export function DayMap({ dayPlaces, tripPlaces, segments, selectedPlaceId, onSelectPlace }: DayMapProps) {
  const theme = useTileTheme();
  const [tileError, setTileError] = useState(false);
  const markers = useMemo(() => buildMapMarkers(dayPlaces, selectedPlaceId), [dayPlaces, selectedPlaceId]);
  const lines = useMemo(() => buildMapLines(dayPlaces, segments), [dayPlaces, segments]);
  const viewport = getMapViewport(dayPlaces, tripPlaces);
  const [initialView] = useState(() =>
    viewport.kind === "bounds" ? { bounds: viewport.bounds } : { center: viewport.center, zoom: viewport.zoom },
  );

  return (
    <div className="relative h-full w-full">
      <MapContainer className="h-full w-full" maxZoom={MAX_ZOOM} scrollWheelZoom zoomControl {...initialView}>
        <TileLayer
          attribution={ATTRIBUTION}
          eventHandlers={{ tileerror: () => setTileError(true), tileload: () => setTileError(false) }}
          key={`${theme}-base`}
          maxNativeZoom={MAX_NATIVE_ZOOM}
          maxZoom={MAX_ZOOM}
          url={TILE_LAYERS[theme].base}
        />
        <TileLayer
          key={`${theme}-labels`}
          maxNativeZoom={MAX_NATIVE_ZOOM}
          maxZoom={MAX_ZOOM}
          url={TILE_LAYERS[theme].labels}
        />
        {lines.map((line) => (
          <Polyline
            key={line.id}
            pathOptions={{
              className: line.className,
              weight: line.lineStyle.weight,
              lineCap: "round",
              opacity: 0.9,
            }}
            positions={line.positions}
          />
        ))}
        {markers.map((marker) => (
          <Marker
            eventHandlers={{ click: () => onSelectPlace(marker.placeId) }}
            icon={createNumberedMarkerIcon(marker.order, marker.isSelected)}
            key={marker.placeId}
            position={marker.position}
            title={marker.name}
          />
        ))}
        <ViewportController
          selectedMarker={markers.find((marker) => marker.isSelected)}
          viewport={viewport}
        />
      </MapContainer>

      {tileError && (
        <p
          className="absolute bottom-8 left-4 z-[1000] border border-rule bg-paper px-4 py-3 text-sm text-ink"
          role="status"
        >
          地圖暫時無法載入
        </p>
      )}
      <div className="absolute top-3 right-3 z-[1000]">
        <MapLegend />
      </div>
    </div>
  );
}
