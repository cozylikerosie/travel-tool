import { z } from "zod";
import { parseMoneyToMinorUnits } from "../../shared/money/budget";
import { CURRENCY_CODES } from "../../shared/money/currencies";

// 花費類別的單一來源：記帳選單與花費結果都讀取這份常數
export const EXPENSE_CATEGORIES = [
  { code: "food", label: "餐飲" },
  { code: "transport", label: "交通" },
  { code: "lodging", label: "住宿" },
  { code: "ticket", label: "門票" },
  { code: "shopping", label: "購物" },
  { code: "other", label: "其他" },
] as const;

export type ExpenseCategoryCode = (typeof EXPENSE_CATEGORIES)[number]["code"];

export const EXPENSE_CATEGORY_CODES = EXPENSE_CATEGORIES.map((category) => category.code) as [
  ExpenseCategoryCode,
  ...ExpenseCategoryCode[],
];

export function getExpenseCategoryLabel(code: ExpenseCategoryCode): string {
  return EXPENSE_CATEGORIES.find((category) => category.code === code)!.label;
}

export const expenseFieldsSchema = z.object({
  dayNumber: z.number().int().positive("請選擇旅程日"),
  amountMinor: z.number().int().safe("金額超出可儲存範圍").positive("金額必須大於零"),
  currency: z.enum(CURRENCY_CODES),
  category: z.enum(EXPENSE_CATEGORY_CODES),
  note: z.string().trim(),
});

export const expenseSchema = expenseFieldsSchema.extend({
  id: z.string().uuid("花費識別碼格式不正確"),
  tripId: z.string().uuid("旅程識別碼格式不正確"),
  createdAt: z.iso.datetime({ offset: false }),
  updatedAt: z.iso.datetime({ offset: false }),
});

const rawExpenseFormSchema = z.object({
  dayNumber: z.number(),
  amount: z.string(),
  currency: z.enum(CURRENCY_CODES),
  category: z.enum(EXPENSE_CATEGORY_CODES),
  note: z.string(),
});

export const expenseFormSchema = rawExpenseFormSchema
  .transform((form, context) => {
    const amountText = form.amount.trim();
    if (!amountText) {
      context.addIssue({ code: "custom", path: ["amount"], message: "請輸入金額" });
      return z.NEVER;
    }
    try {
      return {
        dayNumber: form.dayNumber,
        amountMinor: parseMoneyToMinorUnits(amountText, form.currency),
        currency: form.currency,
        category: form.category,
        note: form.note,
      };
    } catch (error) {
      context.addIssue({
        code: "custom",
        path: ["amount"],
        message: error instanceof Error ? error.message : "金額格式不正確",
      });
      return z.NEVER;
    }
  })
  .pipe(expenseFieldsSchema);

export type Expense = z.infer<typeof expenseSchema>;
export type ExpenseFields = z.infer<typeof expenseFieldsSchema>;
export type ExpenseFormInput = z.input<typeof expenseFormSchema>;
