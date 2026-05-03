import type { Category } from '../types.js';
import { BaseResource } from './base.js';

export class Categories extends BaseResource {
  async list(): Promise<Category[]> {
    return this.http.get<Category[]>('/get_categories', {
      unwrapKey: 'categories',
    });
  }
}
