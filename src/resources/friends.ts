import type { RequestOverrides } from '../http.js';
import type {
  Friend,
  FriendCreateMultipleParams,
  FriendCreateParams,
  FriendDeleteParams,
  FriendGetParams,
} from '../types.js';
import { BaseResource } from './base.js';

export class Friends extends BaseResource {
  async list(overrides?: RequestOverrides): Promise<Friend[]> {
    return this.http.get<Friend[]>('/get_friends', {
      unwrapKey: 'friends',
      ...overrides,
    });
  }

  async get(
    params: FriendGetParams,
    overrides?: RequestOverrides,
  ): Promise<Friend> {
    return this.http.get<Friend>(`/get_friend/${params.id}`, {
      unwrapKey: 'friend',
      ...overrides,
    });
  }

  async create(
    params: FriendCreateParams,
    overrides?: RequestOverrides,
  ): Promise<Friend> {
    // Verified empirically: the API returns { friend: {...} } (singular),
    // matching the OpenAPI spec. v1 incorrectly assumed `friends: [...]`.
    return this.http.post<Friend>('/create_friend', {
      body: { ...params },
      unwrapKey: 'friend',
      ...overrides,
    });
  }

  async createMultiple(
    params: FriendCreateMultipleParams,
    overrides?: RequestOverrides,
  ): Promise<Friend[]> {
    // Per OpenAPI the wire format is `users[]` (not `friends[]`) and the
    // response is wrapped in `users`.
    return this.http.post<Friend[]>('/create_friends', {
      body: { users: params.friends },
      unwrapKey: 'users',
      ...overrides,
    });
  }

  /**
   * Deletes a friendship. Throws SplitwiseConstraintError if the API refuses
   * (most commonly because the friendship has unsettled debts).
   */
  async delete(
    params: FriendDeleteParams,
    overrides?: RequestOverrides,
  ): Promise<void> {
    await this.http.post(`/delete_friend/${params.id}`, overrides);
  }
}
