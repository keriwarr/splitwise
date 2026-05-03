import type { RequestOverrides } from '../http.js';
import type { Notification, NotificationListParams } from '../types.js';
import { BaseResource } from './base.js';

export class Notifications extends BaseResource {
  async list(
    params?: NotificationListParams,
    overrides?: RequestOverrides,
  ): Promise<Notification[]> {
    return this.http.get<Notification[]>('/get_notifications', {
      query: params !== undefined ? { ...params } : undefined,
      unwrapKey: 'notifications',
      ...overrides,
    });
  }
}
