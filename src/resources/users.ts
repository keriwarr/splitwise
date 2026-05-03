import type { RequestOverrides } from '../http.js';
import type {
  CurrentUser,
  User,
  UserGetParams,
  UserUpdateParams,
} from '../types.js';
import { BaseResource } from './base.js';

export class Users extends BaseResource {
  async getCurrent(overrides?: RequestOverrides): Promise<CurrentUser> {
    return this.http.get<CurrentUser>('/get_current_user', {
      unwrapKey: 'user',
      ...overrides,
    });
  }

  async get(
    params: UserGetParams,
    overrides?: RequestOverrides,
  ): Promise<User> {
    return this.http.get<User>(`/get_user/${params.id}`, {
      unwrapKey: 'user',
      ...overrides,
    });
  }

  async update(
    params: UserUpdateParams,
    overrides?: RequestOverrides,
  ): Promise<User> {
    const { id, ...body } = params;
    return this.http.post<User>(`/update_user/${id}`, {
      body,
      unwrapKey: 'user',
      ...overrides,
    });
  }
}
