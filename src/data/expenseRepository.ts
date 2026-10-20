import type { TripDatabase } from "./database";
import { tripDatabase } from "./database";
import { expenseSchema, type Expense, type ExpenseFields } from "../features/expenses/expenseSchema";
import { sortExpenses } from "../features/expenses/expenseSummary";
import type { WriteOptions } from "./itineraryRepository";

export interface ExpenseRepository {
  listForTrip(tripId: string): Promise<Expense[]>;
  add(tripId: string, fields: ExpenseFields, options?: WriteOptions): Promise<Expense>;
  delete(expenseId: string): Promise<void>;
}

export function createExpenseRepository(database: TripDatabase): ExpenseRepository {
  return {
    async listForTrip(tripId) {
      return sortExpenses(await database.expenses.where("tripId").equals(tripId).toArray());
    },

    async add(tripId, fields, options = {}) {
      const now = (options.now ?? (() => new Date()))().toISOString();
      const result = expenseSchema.safeParse({
        ...fields,
        id: (options.createId ?? (() => crypto.randomUUID()))(),
        tripId,
        createdAt: now,
        updatedAt: now,
      });
      if (!result.success) throw new Error(result.error.issues[0]?.message ?? "花費資料不正確");
      await database.expenses.add(result.data);
      return result.data;
    },

    async delete(expenseId) {
      await database.expenses.delete(expenseId);
    },
  };
}

export const expenseRepository = createExpenseRepository(tripDatabase);
