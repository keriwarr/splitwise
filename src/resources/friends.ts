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
    return this.http.post<Friend>('/create_friend', {
      body: { ...params },
      unwrapKey: 'user',
    });
  }

  async createMultiple(params: FriendCreateMultipleParams): Promise<Friend[]> {
    return this.http.post<Friend[]>('/create_friends', {
      body: { ...params },
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
