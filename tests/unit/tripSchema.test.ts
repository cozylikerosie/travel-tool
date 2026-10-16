import { describe, expect, it } from "vitest";
import { tripFormSchema, tripSchema } from "../../src/features/trips/tripSchema";

const validForm = {
  name: "  四國之旅  ",
  destinations: [" 岡山 ", "香川"],
  startDate: "2026-12-20",
  endDate: "2026-12-22",
  budgetAmount: "60000.25",
  budgetCurrency: "TWD" as const,
  companions: ["  小明  "],
  notes: "  冬季旅行  ",
};

const validTrip = {
  id: "3d8dfb88-6a9f-4ef6-8cc5-7084fa8cab2f",
  createdAt: "2026-10-16T01:02:03.000Z",
  updatedAt: "2026-10-16T01:02:03.000Z",
  name: "四國之旅",
  destinations: ["岡山", "香川"],
  startDate: "2026-12-20",
  endDate: "2026-12-22",
  budgetAmountMinor: 6_000_025,
  budgetCurrency: "TWD" as const,
  companions: ["小明"],
  notes: "冬季旅行",
};

describe("shared trip Zod schemas", () => {
  it("validates raw form values and normalizes them into shared trip fields", () => {
    expect(tripFormSchema.parse(validForm)).toEqual({
      name: "四國之旅",
      destinations: ["岡山", "香川"],
      startDate: "2026-12-20",
      endDate: "2026-12-22",
      budgetAmountMinor: 6_000_025,
      budgetCurrency: "TWD",
      companions: ["小明"],
      notes: "  冬季旅行  ",
    });
  });

  it("allows an omitted budget but rejects invalid amounts and missing currency", () => {
    const noBudget = {
      ...validForm,
      budgetAmount: "",
      budgetCurrency: "" as const,
    };
    expect(tripFormSchema.safeParse(noBudget).success).toBe(true);
    expect(
      tripFormSchema.safeParse({ ...validForm, budgetAmount: "0" }).success,
    ).toBe(false);
    expect(
      tripFormSchema.safeParse({ ...validForm, budgetAmount: "60000", budgetCurrency: "" }).success,
    ).toBe(false);
  });

  it("rejects blank required fields and reversed trip dates", () => {
    expect(
      tripFormSchema.safeParse({ ...validForm, name: "   " }).success,
    ).toBe(false);
    expect(
      tripFormSchema.safeParse({ ...validForm, destinations: ["   "] }).success,
    ).toBe(false);
    expect(
      tripFormSchema.safeParse({
        ...validForm,
        startDate: "2026-12-22",
        endDate: "2026-12-20",
      }).success,
    ).toBe(false);
  });

  it("requires UUID and ISO UTC metadata in the complete persisted Trip", () => {
    expect(tripSchema.safeParse(validTrip).success).toBe(true);
    expect(
      tripSchema.safeParse({ ...validTrip, id: "not-a-uuid" }).success,
    ).toBe(false);
    expect(
      tripSchema.safeParse({ ...validTrip, createdAt: undefined }).success,
    ).toBe(false);
  });
});