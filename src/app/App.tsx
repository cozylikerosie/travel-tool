import { ArrowLeft } from "lucide-react";
import { Suspense, lazy, startTransition, useEffect, useState } from "react";
import { itineraryRepository as defaultItineraryRepository, type ItineraryRepository } from "../data/itineraryRepository";
import { expenseRepository as defaultExpenseRepository, type ExpenseRepository } from "../data/expenseRepository";
import { transferRepository as defaultTransferRepository, type TransferRepository } from "../data/transferRepository";
import { tripRepository, type TripRepository } from "../data/tripRepository";
import { TravelModePage } from "../features/travel/TravelModePage";
import { TripForm } from "../features/trips/TripForm";
import { TripDetailsPage } from "../features/trips/TripDetailsPage";
import { TripHomePage } from "../features/trips/TripHomePage";
import { saveTrip } from "../features/trips/saveTrip";
import { getTodayLocalDate } from "../shared/dates/tripDates";
import type { Trip, TripFormInput } from "../features/trips/tripSchema";

// 每日行程頁含 Leaflet 地圖，延後到開啟時才載入，縮小首頁的主程式
const DayItineraryPage = lazy(() =>
  import("../features/itinerary/DayItineraryPage").then((module) => ({ default: module.DayItineraryPage })),
);

interface AppProps {
  repository?: TripRepository;
  itineraryRepository?: ItineraryRepository;
  expenseRepository?: ExpenseRepository;
  transferRepository?: TransferRepository;
}

export function App({
  repository = tripRepository,
  itineraryRepository = defaultItineraryRepository,
  expenseRepository = defaultExpenseRepository,
  transferRepository = defaultTransferRepository,
}: AppProps = {}) {
  const [trips, setTrips] = useState<Trip[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [selectedTripId, setSelectedTripId] = useState<string | null>(null);
  const [isItineraryOpen, setIsItineraryOpen] = useState(false);
  const [isTravelModeOpen, setIsTravelModeOpen] = useState(false);
  const [copyDraft, setCopyDraft] = useState<TripFormInput | undefined>();
  const [loadError, setLoadError] = useState("");

  useEffect(() => {
    let isCurrent = true;
    repository
      .listAll()
      .then((savedTrips) => {
        if (isCurrent) startTransition(() => setTrips(savedTrips));
      })
      .catch(() => {
        if (isCurrent) setLoadError("無法讀取旅程資料，請重新整理頁面。");
      })
      .finally(() => {
        if (isCurrent) setIsLoading(false);
      });

    return () => {
      isCurrent = false;
    };
  }, [repository]);

  function handleSavedTrip(savedTrip: Trip) {
    setTrips((currentTrips) =>
      [...currentTrips.filter((trip) => trip.id !== savedTrip.id), savedTrip].sort(
        (left, right) => left.startDate.localeCompare(right.startDate),
      ),
    );
    setIsCreating(false);
    setCopyDraft(undefined);
  }

  async function handleDeletedTrip(id: string) {
    await repository.delete(id);
    setTrips((currentTrips) => currentTrips.filter((trip) => trip.id !== id));
    setSelectedTripId(null);
  }

  async function handleImportItinerary(text: string) {
    const result = await transferRepository.importItinerary(text);
    setTrips(await repository.listAll());
    return result.replaced
      ? `已更新「${result.trip.name}」的行程（花費記錄保留）。`
      : `已匯入「${result.trip.name}」。`;
  }

  function handleCopyTrip(initialValues: TripFormInput) {
    setSelectedTripId(null);
    setCopyDraft(initialValues);
    setIsCreating(true);
  }

  if (isLoading) {
    return (
      <main aria-busy="true" className="mx-auto grid min-h-screen max-w-7xl content-center px-5 md:px-12">
        <p className="font-title text-xl text-muted">正在讀取旅程…</p>
      </main>
    );
  }

  if (loadError) {
    return (
      <main className="mx-auto grid min-h-screen max-w-7xl content-center px-5 md:px-12">
        <p className="text-ink" role="alert">{loadError}</p>
      </main>
    );
  }

  if (isCreating) {
    return (
      <main className="mx-auto grid min-h-screen w-full max-w-5xl content-start gap-8 px-5 py-8 md:gap-12 md:px-12 md:py-12">
        <header className="grid gap-6 border-b border-rule pb-7">
          <button
            className="inline-flex min-h-11 w-fit items-center gap-2 text-sm text-muted hover:text-ink"
            onClick={() => {
              setIsCreating(false);
              setCopyDraft(undefined);
            }}
            type="button"
          >
            <ArrowLeft aria-hidden="true" className="size-4" />
            返回旅程列表
          </button>
          <div className="grid gap-2">
            <p className="font-label text-xs uppercase tracking-[0.15em] text-muted">
              NEW JOURNEY
            </p>
            <h1 className="font-title text-4xl text-ink md:text-5xl">建立旅程</h1>
          </div>
        </header>
        <TripForm
          initialValues={copyDraft}
          onSaved={handleSavedTrip}
          save={(input, existingTrip) =>
            saveTrip(input, { existingTrip, repository })
          }
        />
      </main>
    );
  }

  const selectedTrip = trips.find((trip) => trip.id === selectedTripId);
  if (selectedTrip && isItineraryOpen) {
    return (
      <Suspense
        fallback={
          <main aria-busy="true" className="mx-auto grid min-h-screen max-w-7xl content-center px-5 md:px-12">
            <p className="font-title text-xl text-muted">正在讀取每日行程…</p>
          </main>
        }
      >
        <DayItineraryPage
          onBack={() => setIsItineraryOpen(false)}
          repository={itineraryRepository}
          trip={selectedTrip}
        />
      </Suspense>
    );
  }

  if (selectedTrip && isTravelModeOpen) {
    return (
      <TravelModePage
        expenseRepository={expenseRepository}
        itineraryRepository={itineraryRepository}
        onBack={() => setIsTravelModeOpen(false)}
        transferRepository={transferRepository}
        trip={selectedTrip}
      />
    );
  }

  if (selectedTrip) {
    return (
      <TripDetailsPage
        expenseRepository={expenseRepository}
        onOpenTravelMode={() => setIsTravelModeOpen(true)}
        transferRepository={transferRepository}
        onBack={() => setSelectedTripId(null)}
        onCopy={handleCopyTrip}
        onDeleted={handleDeletedTrip}
        onOpenItinerary={() => setIsItineraryOpen(true)}
        itineraryRepository={itineraryRepository}
        onSaved={handleSavedTrip}
        repository={repository}
        trip={selectedTrip}
      />
    );
  }

  return (
    <TripHomePage
      onCreate={() => setIsCreating(true)}
      onImportItinerary={handleImportItinerary}
      onSelect={(trip) => setSelectedTripId(trip.id)}
      today={getTodayLocalDate()}
      trips={trips}
    />
  );
}