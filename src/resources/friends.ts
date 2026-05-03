import type {
  Friend,
  FriendCreateMultipleParams,
  FriendCreateParams,
  FriendDeleteParams,
  FriendGetParams,
} from '../types.js';
import { BaseResource } from './base.js';

export class Friends extends BaseResource {
  async list(): Promise<Friend[]> {
    return this.http.get<Friend[]>('/get_friends', { unwrapKey: 'friends' });
  }

  async get(params: FriendGetParams): Promise<Friend> {
    return this.http.get<Friend>(`/get_friend/${params.id}`, {
      unwrapKey: 'friend',
    });
  }

  async create(params: FriendCreateParams): Promise<Friend> {
    // Verified empirically: the API returns { friend: {...} } (singular),
    // matching the OpenAPI spec. v1 incorrectly assumed `friends: [...]`.
    return this.http.post<Friend>('/create_friend', {
      body: { ...params },
      unwrapKey: 'friend',
    });
  }

  async createMultiple(params: FriendCreateMultipleParams): Promise<Friend[]> {
    // Per OpenAPI the wire format is `users[]` (not `friends[]`) and the
    // response is wrapped in `users`.
    return this.http.post<Friend[]>('/create_friends', {
      body: { users: params.friends },
      unwrapKey: 'users',
    });
  }

  /**
   * Deletes a friendship. Throws SplitwiseConstraintError if the API refuses
   * (most commonly because the friendship has unsettled debts).
   */
  async delete(params: FriendDeleteParams): Promise<void> {
    await this.http.post(`/delete_friend/${params.id}`);
  }
}
