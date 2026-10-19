import { ArrowLeft, MoveRight, Pencil, Plus, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { itineraryRepository, type ItineraryRepository } from "../../data/itineraryRepository";
import { listTripDays } from "../../shared/dates/tripDates";
import type { Trip } from "../trips/tripSchema";
import { DayMap } from "./DayMap";
import { DeletePlaceDialog } from "./DeletePlaceDialog";
import { MovePlaceDialog } from "./MovePlaceDialog";
import { DayTabs } from "./DayTabs";
import type { Place, TransportSegment } from "./itinerarySchema";
import { moveItem, segmentId } from "./itineraryOrdering";
import { PlaceFormDialog } from "./PlaceFormDialog";
import { PlaceTimeline } from "./PlaceTimeline";
import { TransportSegmentRow } from "./TransportSegmentRow";
import type { TransportModeCode } from "./transportModes";

interface DayItineraryPageProps {
  trip: Trip;
  repository?: ItineraryRepository;
  onBack: () => void;
}

export function DayItineraryPage({ trip, repository = itineraryRepository, onBack }: DayItineraryPageProps) {
  const days = listTripDays(trip.startDate, trip.endDate);
  const [selectedDayNumber, setSelectedDayNumber] = useState(1);
  const [places, setPlaces] = useState<Place[]>([]);
  const [tripPlaces, setTripPlaces] = useState<Place[]>([]);
  const [segments, setSegments] = useState<TransportSegment[]>([]);
  const [selection, setSelection] = useState<{ placeId: string; source: "map" | "list" } | null>(null);
  const [isAdding, setIsAdding] = useState(false);
  const [editingPlace, setEditingPlace] = useState<Place | null>(null);
  const [deletingPlace, setDeletingPlace] = useState<Place | null>(null);
  const [movingPlace, setMovingPlace] = useState<Place | null>(null);
  const [dataVersion, setDataVersion] = useState(0);
  const [loadError, setLoadError] = useState("");
  const [notice, setNotice] = useState("");

  const dayNumber = Math.min(selectedDayNumber, days.length);
  const day = days[dayNumber - 1]!;
  const segmentModes = new Map(segments.map((segment) => [segment.id, segment.mode]));

  useEffect(() => {
    let isCurrent = true;
    Promise.all([
      repository.listPlacesForDay(trip.id, dayNumber),
      repository.listSegmentsForDay(trip.id, dayNumber),
      repository.listPlacesForTrip(trip.id),
    ])
      .then(([dayPlaces, daySegments, allPlaces]) => {
        if (!isCurrent) return;
        setPlaces(dayPlaces);
        setSegments(daySegments);
        setTripPlaces(allPlaces);
        setSelection((current) =>
          current && dayPlaces.some((place) => place.id === current.placeId) ? current : null,
        );
        setLoadError("");
      })
      .catch(() => {
        if (isCurrent) setLoadError("無法讀取每日行程，請重新整理頁面。");
      });
    return () => {
      isCurrent = false;
    };
  }, [repository, trip.id, dayNumber, dataVersion]);

  function refresh() {
    setDataVersion((version) => version + 1);
  }

  async function handleTransportChange(from: Place, to: Place, mode: TransportModeCode | null) {
    const id = segmentId(from.id, to.id);
    setSegments((current) => {
      const others = current.filter((segment) => segment.id !== id);
      if (!mode) return others;
      return [
        ...others,
        { id, tripId: trip.id, dayNumber, fromPlaceId: from.id, toPlaceId: to.id, mode, updatedAt: new Date().toISOString() },
      ];
    });
    try {
      await repository.setTransportMode(trip.id, dayNumber, from.id, to.id, mode);
    } catch {
      setLoadError("無法儲存交通方式，請稍後再試。");
    }
    refresh();
  }

  async function handleReorder(placeId: string, toIndex: number) {
    const fromIndex = places.findIndex((place) => place.id === placeId);
    if (fromIndex < 0) return;
    setPlaces((current) => moveItem(current, fromIndex, toIndex));
    try {
      const moved = await repository.reorderPlace(trip.id, dayNumber, placeId, toIndex);
      setNotice(`已將「${moved.name || "未命名地點"}」的抵達時間改為 ${moved.arrivalTime}，可再按編輯修改。`);
    } catch {
      setLoadError("無法調整順序，請稍後再試。");
    }
    refresh();
  }

  function handleSelectDay(nextDayNumber: number) {
    setSelectedDayNumber(nextDayNumber);
    setSelection(null);
    setIsAdding(false);
    setEditingPlace(null);
    setNotice("");
  }

  return (
    <main className="mx-auto grid min-h-screen w-full max-w-[1600px] content-start gap-6 px-5 py-8 md:px-12 md:py-10 lg:h-screen lg:grid-rows-[auto_minmax(0,1fr)] lg:content-stretch">
      <header className="grid gap-5">
        <button
          className="inline-flex min-h-11 w-fit items-center gap-2 text-sm text-muted hover:text-ink"
          onClick={onBack}
          type="button"
        >
          <ArrowLeft aria-hidden="true" className="size-4" />
          返回旅程
        </button>
        <div className="grid gap-2">
          <p className="font-label text-xs uppercase tracking-[0.15em] text-muted">DAILY ITINERARY</p>
          <h1 className="font-title text-4xl leading-tight text-ink md:text-5xl">{trip.name}</h1>
        </div>
        <DayTabs days={days} onSelect={handleSelectDay} selectedDayNumber={dayNumber} />
      </header>

      <div
        className="grid grid-cols-1 gap-8 lg:min-h-0 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)] lg:gap-12"
        data-testid="itinerary-layout"
      >
        {/* 寬螢幕時整頁固定一個螢幕高：時間軸在自己的區塊內捲動，地圖填滿右欄 */}
        <section aria-label="當天時間軸" className="grid content-start gap-6 lg:min-h-0 lg:overflow-y-auto lg:pr-3">
          <div className="flex flex-wrap items-end justify-between gap-4 border-b-2 border-ink bg-paper pb-3 lg:sticky lg:top-0 lg:z-10">
            <h2 className="font-display text-3xl text-ink">{day.label}</h2>
            {places.length > 0 && (
              <button
                className="inline-flex min-h-11 items-center gap-2 border border-ink px-4 text-sm text-ink hover:bg-ink hover:text-paper"
                onClick={() => setIsAdding(true)}
                type="button"
              >
                <Plus aria-hidden="true" className="size-4" />
                新增地點
              </button>
            )}
          </div>

          {loadError && <p className="text-sm text-ink" role="alert">{loadError}</p>}
          <p className="text-sm text-muted empty:hidden" role="status">{notice}</p>

          {isAdding && (
            <PlaceFormDialog
              onCancel={() => setIsAdding(false)}
              onSubmit={async (fields) => {
                await repository.addPlace(trip.id, dayNumber, fields);
                setIsAdding(false);
                refresh();
              }}
            />
          )}

          {editingPlace && (
            <PlaceFormDialog
              initialPlace={editingPlace}
              key={editingPlace.id}
              onCancel={() => setEditingPlace(null)}
              onSubmit={async (fields) => {
                await repository.updatePlace(editingPlace.id, fields);
                setEditingPlace(null);
                refresh();
              }}
            />
          )}

          <PlaceTimeline
            dayLabel={day.label}
            onAdd={() => setIsAdding(true)}
            onReorder={(placeId, toIndex) => void handleReorder(placeId, toIndex)}
            onSelectPlace={(placeId) => setSelection({ placeId, source: "list" })}
            places={places}
            scrollToSelected={selection?.source === "map"}
            selectedPlaceId={selection?.placeId ?? null}
            renderActions={(place) => {
              const name = place.name || "未命名地點";
              const actionClass =
                "grid size-11 place-items-center text-muted hover:text-ink";
              return (
                <>
                  <button
                    aria-label={`編輯：${name}`}
                    className={actionClass}
                    onClick={() => {
                      setIsAdding(false);
                      setEditingPlace(place);
                    }}
                    type="button"
                  >
                    <Pencil aria-hidden="true" className="size-4" />
                  </button>
                  <button
                    aria-label={`移到其他天：${name}`}
                    className={actionClass}
                    disabled={days.length < 2}
                    onClick={() => setMovingPlace(place)}
                    type="button"
                  >
                    <MoveRight aria-hidden="true" className="size-4" />
                  </button>
                  <button
                    aria-label={`刪除：${name}`}
                    className={`${actionClass} hover:text-budget-over`}
                    onClick={() => setDeletingPlace(place)}
                    type="button"
                  >
                    <Trash2 aria-hidden="true" className="size-4" />
                  </button>
                </>
              );
            }}
            renderSegment={(from, to) => (
              <TransportSegmentRow
                from={from}
                mode={segmentModes.get(segmentId(from.id, to.id)) ?? null}
                onChange={(mode) => void handleTransportChange(from, to, mode)}
                to={to}
              />
            )}
          />
        </section>

        <section
          aria-label="當天地圖"
          className="h-[420px] min-h-0 border border-rule lg:h-full"
          data-testid="map-panel"
        >
          <DayMap
            dayPlaces={places}
            onSelectPlace={(placeId) => setSelection({ placeId, source: "map" })}
            segments={segments}
            selectedPlaceId={selection?.placeId ?? null}
            tripPlaces={tripPlaces}
          />
        </section>
      </div>

      {deletingPlace && (
        <DeletePlaceDialog
          onCancel={() => setDeletingPlace(null)}
          onConfirm={async () => {
            await repository.deletePlace(deletingPlace.id);
            if (editingPlace?.id === deletingPlace.id) setEditingPlace(null);
            setDeletingPlace(null);
            refresh();
          }}
          placeName={deletingPlace.name || "未命名地點"}
        />
      )}

      {movingPlace && (
        <MovePlaceDialog
          currentDayNumber={dayNumber}
          days={days}
          onCancel={() => setMovingPlace(null)}
          onConfirm={async (targetDayNumber) => {
            await repository.movePlace(movingPlace.id, targetDayNumber);
            if (editingPlace?.id === movingPlace.id) setEditingPlace(null);
            setMovingPlace(null);
            refresh();
          }}
          placeName={movingPlace.name || "未命名地點"}
        />
      )}
    </main>
  );
}
