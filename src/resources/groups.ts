import type {
  AddUserToGroupParams,
  Group,
  GroupCreateParams,
  GroupDeleteParams,
  GroupGetParams,
  GroupListParams,
  GroupRestoreParams,
  RemoveUserFromGroupParams,
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

  async delete(params: GroupDeleteParams): Promise<{ success: boolean }> {
    const success = await this.http.post<boolean>(
      `/delete_group/${params.id}`,
      { unwrapKey: 'success' },
    );
    return { success };
  }

  async restore(params: GroupRestoreParams): Promise<{ success: boolean }> {
    const success = await this.http.post<boolean>(
      `/undelete_group/${params.id}`,
      { unwrapKey: 'success' },
    );
    return { success };
  }

  async addUser(params: AddUserToGroupParams): Promise<{ success: boolean }> {
    const success = await this.http.post<boolean>('/add_user_to_group', {
      body: { ...params },
      unwrapKey: 'success',
    });
    return { success };
  }

  async removeUser(
    params: RemoveUserFromGroupParams,
  ): Promise<{ success: boolean }> {
    const success = await this.http.post<boolean>('/remove_user_from_group', {
      body: { ...params },
      unwrapKey: 'success',
    });
    return { success };
  }
}
