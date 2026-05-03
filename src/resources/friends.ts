import { SplitwiseError } from '../errors.js';
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
    // The API returns { friends: [theNewFriend] } even for single creates.
    const friends = await this.http.post<Friend[]>('/create_friend', {
      body: { ...params },
      unwrapKey: 'friends',
    });
    const first = friends[0];
    if (!first) throw new SplitwiseError('Splitwise returned no friend');
    return first;
  }

  async createMultiple(params: FriendCreateMultipleParams): Promise<Friend[]> {
    // Per OpenAPI the wire format is `users[]` (not `friends[]`) and the
    // response is wrapped in `users`.
    return this.http.post<Friend[]>('/create_friends', {
      body: { users: params.friends },
      unwrapKey: 'users',
    });
  }

  async delete(params: FriendDeleteParams): Promise<{ success: boolean }> {
    const success = await this.http.post<boolean>(
      `/delete_friend/${params.id}`,
      { unwrapKey: 'success' },
    );
    return { success };
  }
}
