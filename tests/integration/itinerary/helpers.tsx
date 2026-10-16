import { IDBFactory } from "fake-indexeddb";
import { fireEvent, screen, within } from "@testing-library/react";
import type { UserEvent } from "@testing-library/user-event";
import { createTripDatabase, type TripDatabase } from "../../../src/data/database";
import { createItineraryRepository } from "../../../src/data/itineraryRepository";
import { createTripRepository } from "../../../src/data/tripRepository";
import type { PlaceFields, TransportSegment } from "../../../src/features/itinerary/itinerarySchema";
import type { TransportModeCode } from "../../../src/features/itinerary/transportModes";
import type { Trip } from "../../../src/features/trips/tripSchema";

export const TRIP_ID = "3d8dfb88-6a9f-4ef6-8cc5-7084fa8cab2f";

export const nineDayTrip: Trip = {
  id: TRIP_ID,
  createdAt: "2026-10-16T01:02:03.000Z",
  updatedAt: "2026-10-16T01:02:03.000Z",
  name: "四國之旅",
  destinations: ["岡山", "香川", "愛媛"],
  startDate: "2026-12-10",
  endDate: "2026-12-18",
  budgetAmountMinor: null,
  budgetCurrency: null,
  companions: [],
  notes: "",
};

export const KORAKUEN = { lat: 34.6672, lng: 133.9354 };
export const CASTLE = { lat: 34.665, lng: 133.936 };
export const KURASHIKI = { lat: 34.5951, lng: 133.772 };

const databases: TripDatabase[] = [];

export async function cleanupDatabases() {
  const active = databases.splice(0);
  for (const database of active) database.close();
  await Promise.all(active.map((database) => database.delete()));
}

export async function setupItinerary(trip: Trip = nineDayTrip) {
  const database = createTripDatabase(`itinerary-ui-${crypto.randomUUID()}`, new IDBFactory());
  databases.push(database);
  const tripRepository = createTripRepository(database);
  const itineraryRepository = createItineraryRepository(database);
  await tripRepository.create(trip);

  async function addPlace(dayNumber: number, name: string, arrivalTime: string, overrides: Partial<PlaceFields> = {}) {
    return itineraryRepository.addPlace(trip.id, dayNumber, {
      name,
      address: "",
      coordinates: null,
      arrivalTime,
      stay: { kind: "none" },
      notes: "",
      ...overrides,
    });
  }

  async function setMode(dayNumber: number, fromId: string, toId: string, mode: TransportModeCode | null) {
    await itineraryRepository.setTransportMode(trip.id, dayNumber, fromId, toId, mode);
  }

  async function segments(dayNumber: number): Promise<TransportSegment[]> {
    return itineraryRepository.listSegmentsForDay(trip.id, dayNumber);
  }

  return { database, tripRepository, itineraryRepository, trip, addPlace, setMode, segments };
}

export function setTime(label: string, value: string) {
  fireEvent.change(screen.getByLabelText(label), { target: { value } });
}

export async function timelineNames(): Promise<string[]> {
  const list = await screen.findByRole("list", { name: /的地點$/ });
  return within(list)
    .queryAllByTestId("place-name")
    .map((element) => element.textContent ?? "");
}

export async function selectDay(user: UserEvent, label: string) {
  await user.click(screen.getByRole("tab", { name: label }));
}
