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
  async list(_params?: GroupListParams): Promise<Group[]> {
    return this.http.get<Group[]>('/get_groups', { unwrapKey: 'groups' });
  }

  async get(params: GroupGetParams): Promise<Group> {
    return this.http.get<Group>(`/get_group/${params.id}`, {
      unwrapKey: 'group',
    });
  }

  async create(params: GroupCreateParams): Promise<Group> {
    return this.http.post<Group>('/create_group', {
      body: { ...params },
      unwrapKey: 'group',
    });
  }

  /** Deletes a group. Throws SplitwiseConstraintError if the API refuses. */
  async delete(params: GroupDeleteParams): Promise<void> {
    await this.http.post(`/delete_group/${params.id}`);
  }

  /** Restores a previously-deleted group. Throws on failure. */
  async restore(params: GroupRestoreParams): Promise<void> {
    await this.http.post(`/undelete_group/${params.id}`);
  }

  /**
   * Adds a user to a group. Returns the added user object (useful when
   * adding by email -- the response gives you back the assigned user_id).
   * Throws SplitwiseConstraintError if the API refuses (e.g. unknown user).
   */
  async addUser(params: AddUserToGroupParams): Promise<User> {
    return this.http.post<User>('/add_user_to_group', {
      body: { ...params },
      unwrapKey: 'user',
    });
  }

  /**
   * Removes a user from a group. Throws SplitwiseConstraintError if the API
   * refuses (e.g. the user has unsettled debts in this group).
   */
  async removeUser(params: RemoveUserFromGroupParams): Promise<void> {
    await this.http.post('/remove_user_from_group', { body: { ...params } });
  }
}
