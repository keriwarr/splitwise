import { SplitwiseError } from '../errors.js';
import { createPagedResult, type PagedResult } from '../pagination.js';
import type {
  CreateDebtParams,
  Expense,
  ExpenseCreateParams,
  ExpenseDeleteParams,
  ExpenseGetParams,
  ExpenseListParams,
  ExpenseRestoreParams,
  ExpenseUpdateParams,
} from '../types.js';
import { BaseResource } from './base.js';

export class Expenses extends BaseResource {
  list(params?: ExpenseListParams): PagedResult<Expense> {
    const { limit, offset, ...query } = params ?? {};
    return createPagedResult<Expense>(this.http, '/get_expenses', 'expenses', {
      ...(limit !== undefined && { limit }),
      ...(offset !== undefined && { offset }),
      query,
    });
  }

  async get(params: ExpenseGetParams): Promise<Expense> {
    return this.http.get<Expense>(`/get_expense/${params.id}`, {
      unwrapKey: 'expense',
    });
  }

  async create(params: ExpenseCreateParams): Promise<Expense> {
    const expenses = await this.http.post<Expense[]>('/create_expense', {
      body: { ...params },
      unwrapKey: 'expenses',
    });
    const first = expenses[0];
    if (!first) throw new SplitwiseError('Splitwise returned no expense');
    return first;
  }

  async update(params: ExpenseUpdateParams): Promise<Expense> {
    const { id, ...body } = params;
    const expenses = await this.http.post<Expense[]>(`/update_expense/${id}`, {
      body: { ...body },
      unwrapKey: 'expenses',
    });
    const first = expenses[0];
    if (!first) throw new SplitwiseError('Splitwise returned no expense');
    return first;
  }

  /**
   * Deletes an expense. Throws SplitwiseConstraintError if the API returns
   * `success: false` (e.g. you don't have permission). Returns nothing on
   * success -- the absence of an exception is the signal.
   */
  async delete(params: ExpenseDeleteParams): Promise<void> {
    await this.http.post(`/delete_expense/${params.id}`);
  }

  /** Restores a previously-deleted expense. Throws on failure. */
  async restore(params: ExpenseRestoreParams): Promise<void> {
    await this.http.post(`/undelete_expense/${params.id}`);
  }

  async createDebt(params: CreateDebtParams): Promise<Expense> {
    const { from, to, amount, description, groupId, date } = params;
    const cost = typeof amount === 'number' ? String(amount) : amount;
    return this.create({
      payment: false,
      cost,
      description: description ?? '',
      ...(groupId !== undefined && { groupId }),
      ...(date !== undefined && { date }),
      // v1 only set paidShare/owedShare on the relevant side. We mirror that to
      // minimize the request payload and avoid surprising server-side validation.
      users: [
        { userId: from, paidShare: cost },
        { userId: to, owedShare: cost },
      ],
    });
  }
}
