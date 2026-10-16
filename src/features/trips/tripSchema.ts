import { z } from "zod";
import { isDateOnly } from "../../shared/dates/tripDates";
import { parseMoneyToMinorUnits } from "../../shared/money/budget";
import { CURRENCY_CODES, type CurrencyCode } from "../../shared/money/currencies";

const currencySchema = z.enum(CURRENCY_CODES);

export const tripFieldsSchema = z
  .object({
    name: z.string().trim().min(1, "請輸入旅程名稱"),
    destinations: z
      .array(z.string().trim().min(1, "目的地不可空白"))
      .min(1, "請至少輸入一個目的地"),
    startDate: z.string().refine(isDateOnly, "請輸入有效的出發日期"),
    endDate: z.string().refine(isDateOnly, "請輸入有效的回程日期"),
    budgetAmountMinor: z
      .number()
      .int("預算金額必須是整數最小單位")
      .safe("預算金額超出可儲存範圍")
      .positive("預算金額必須大於零")
      .nullable(),
    budgetCurrency: currencySchema.nullable(),
    companions: z.array(z.string().trim().min(1, "同行者名稱不可空白")),
    notes: z.string(),
  })
  .superRefine((trip, context) => {
    if (trip.endDate < trip.startDate) {
      context.addIssue({
        code: "custom",
        path: ["endDate"],
        message: "回程日期不可早於出發日期",
      });
    }

    if ((trip.budgetAmountMinor === null) !== (trip.budgetCurrency === null)) {
      context.addIssue({
        code: "custom",
        path: [trip.budgetAmountMinor === null ? "budgetCurrency" : "budgetAmountMinor"],
        message: "預算金額與幣別須一併提供",
      });
    }
  });

const rawTripFormSchema = z.object({
  name: z.string(),
  destinations: z.array(z.string()),
  startDate: z.string(),
  endDate: z.string(),
  budgetAmount: z.string().optional().default(""),
  budgetCurrency: z.union([currencySchema, z.literal("")]).optional().default(""),
  companions: z.array(z.string()).optional().default([]),
  notes: z.string().optional().default(""),
});

export const tripFormSchema = rawTripFormSchema
  .transform((form, context) => {
    const amountText = form.budgetAmount.trim();
    let budgetAmountMinor: number | null = null;
    let budgetCurrency: CurrencyCode | null = null;

    if (amountText) {
      if (!form.budgetCurrency) {
        context.addIssue({
          code: "custom",
          path: ["budgetCurrency"],
          message: "請選擇預算幣別",
        });
        return z.NEVER;
      }

      try {
        budgetAmountMinor = parseMoneyToMinorUnits(amountText, form.budgetCurrency);
        budgetCurrency = form.budgetCurrency;
      } catch (error) {
        context.addIssue({
          code: "custom",
          path: ["budgetAmount"],
          message: error instanceof Error ? error.message : "預算金額格式不正確",
        });
        return z.NEVER;
      }
    }

    return {
      name: form.name,
      destinations: form.destinations,
      startDate: form.startDate,
      endDate: form.endDate,
      budgetAmountMinor,
      budgetCurrency,
      companions: form.companions,
      notes: form.notes,
    };
  })
  .pipe(tripFieldsSchema);

export const tripSchema = tripFieldsSchema.extend({
  id: z.string().uuid("旅程識別碼格式不正確"),
  createdAt: z.iso.datetime({ offset: false }),
  updatedAt: z.iso.datetime({ offset: false }),
});

export type Trip = z.infer<typeof tripSchema>;
export type TripFields = z.infer<typeof tripFieldsSchema>;
export type TripFormInput = z.input<typeof tripFormSchema>;