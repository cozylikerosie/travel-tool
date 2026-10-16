import { tripRepository, type TripRepository } from "../../data/tripRepository";
import {
  tripFormSchema,
  tripSchema,
  type Trip,
  type TripFormInput,
} from "./tripSchema";

export type TripFormField = keyof TripFormInput;
export type TripFieldErrors = Partial<Record<TripFormField, string>>;

export type SaveTripResult =
  | { success: true; trip: Trip }
  | { success: false; message: string; fieldErrors: TripFieldErrors };

export interface SaveTripOptions {
  existingTrip?: Trip;
  repository?: TripRepository;
  createId?: () => string;
  now?: () => Date;
}

const FORM_FIELDS = new Set<string>([
  "name",
  "destinations",
  "startDate",
  "endDate",
  "budgetAmount",
  "budgetCurrency",
  "companions",
  "notes",
]);

function fieldErrorsFromIssues(
  issues: readonly { path: PropertyKey[]; message: string }[],
): TripFieldErrors {
  const fieldErrors: TripFieldErrors = {};

  for (const issue of issues) {
    const firstPath = issue.path[0];
    const field = firstPath === "budgetAmountMinor" ? "budgetAmount" : firstPath;
    if (typeof field === "string" && FORM_FIELDS.has(field)) {
      const formField = field as TripFormField;
      fieldErrors[formField] ??= issue.message;
    }
  }

  return fieldErrors;
}

export async function saveTrip(
  formInput: TripFormInput,
  options: SaveTripOptions = {},
): Promise<SaveTripResult> {
  const formResult = tripFormSchema.safeParse(formInput);
  if (!formResult.success) {
    return {
      success: false,
      message: "請修正旅程資料中的錯誤。",
      fieldErrors: fieldErrorsFromIssues(formResult.error.issues),
    };
  }

  try {
    const existingTrip = options.existingTrip;
    const now = (options.now ?? (() => new Date()))().toISOString();
    const metadata = existingTrip
      ? {
          id: existingTrip.id,
          createdAt: existingTrip.createdAt,
          updatedAt: now,
        }
      : {
          id: (options.createId ?? (() => crypto.randomUUID()))(),
          createdAt: now,
          updatedAt: now,
        };

    const tripResult = tripSchema.safeParse({ ...formResult.data, ...metadata });
    if (!tripResult.success) {
      return {
        success: false,
        message: "旅程儲存失敗，旅程資料格式不正確。",
        fieldErrors: fieldErrorsFromIssues(tripResult.error.issues),
      };
    }

    const repository = options.repository ?? tripRepository;
    if (existingTrip) {
      await repository.update(tripResult.data);
    } else {
      await repository.create(tripResult.data);
    }

    return { success: true, trip: tripResult.data };
  } catch {
    return {
      success: false,
      message: "旅程儲存失敗，請稍後再試。",
      fieldErrors: {},
    };
  }
}