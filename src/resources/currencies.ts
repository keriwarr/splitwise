import type { Currency } from '../types.js';
import { BaseResource } from './base.js';

export class Currencies extends BaseResource {
  async list(): Promise<Currency[]> {
    return this.http.get<Currency[]>('/get_currencies', {
      unwrapKey: 'currencies',
    });
  }
}
