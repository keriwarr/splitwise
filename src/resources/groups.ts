import type { RequestOverrides } from '../http.js';
import type {
  AddUserToGroupParams,
  Group,
  GroupCreateParams,
  GroupDeleteParams,
  GroupGetParams,
  GroupListParams,
  GroupRestoreParams,
  RemoveUserFromGroupParams,
  User,
} from '../types.js';
import { BaseResource } from './base.js';

export class Groups extends BaseResource {
  async list(
    _params?: GroupListParams,
    overrides?: RequestOverrides,
  ): Promise<Group[]> {
    return this.http.get<Group[]>('/get_groups', {
      unwrapKey: 'groups',
      ...overrides,
    });
  }

  async get(
    params: GroupGetParams,
    overrides?: RequestOverrides,
  ): Promise<Group> {
    return this.http.get<Group>(`/get_group/${params.id}`, {
      unwrapKey: 'group',
      ...overrides,
    });
  }

  async create(
    params: GroupCreateParams,
    overrides?: RequestOverrides,
  ): Promise<Group> {
    return this.http.post<Group>('/create_group', {
      body: { ...params },
      unwrapKey: 'group',
      ...overrides,
    });
  }

  /** Deletes a group. Throws SplitwiseConstraintError if the API refuses. */
  async delete(
    params: GroupDeleteParams,
    overrides?: RequestOverrides,
  ): Promise<void> {
    await this.http.post(`/delete_group/${params.id}`, overrides);
  }

  /** Restores a previously-deleted group. Throws on failure. */
  async restore(
    params: GroupRestoreParams,
    overrides?: RequestOverrides,
  ): Promise<void> {
    await this.http.post(`/undelete_group/${params.id}`, overrides);
  }

  /**
   * Adds a user to a group. Returns the added user object (useful when
   * adding by email -- the response gives you back the assigned user_id).
   * Throws SplitwiseConstraintError if the API refuses (e.g. unknown user).
   */
  async addUser(
    params: AddUserToGroupParams,
    overrides?: RequestOverrides,
  ): Promise<User> {
    return this.http.post<User>('/add_user_to_group', {
      body: { ...params },
      unwrapKey: 'user',
      ...overrides,
    });
  }

  /**
   * Removes a user from a group. Throws SplitwiseConstraintError if the API
   * refuses (e.g. the user has unsettled debts in this group).
   */
  async removeUser(
    params: RemoveUserFromGroupParams,
    overrides?: RequestOverrides,
  ): Promise<void> {
    await this.http.post('/remove_user_from_group', {
      body: { ...params },
      ...overrides,
    });
  }
}
