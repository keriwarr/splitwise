import type {
  CurrentUser,
  User,
  UserGetParams,
  UserUpdateParams,
} from '../types.js';
import { BaseResource } from './base.js';

export class Users extends BaseResource {
  async getCurrent(): Promise<CurrentUser> {
    return this.http.get<CurrentUser>('/get_current_user', {
      unwrapKey: 'user',
    });
  }

  async get(params: UserGetParams): Promise<User> {
    return this.http.get<User>(`/get_user/${params.id}`, { unwrapKey: 'user' });
  }

  async update(params: UserUpdateParams): Promise<User> {
    const { id, ...body } = params;
    return this.http.post<User>(`/update_user/${id}`, {
      body,
      unwrapKey: 'user',
    });
  }
}
