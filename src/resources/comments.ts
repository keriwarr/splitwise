import type { RequestOverrides } from '../http.js';
import type {
  Comment,
  CommentCreateParams,
  CommentDeleteParams,
  CommentListParams,
} from '../types.js';
import { BaseResource } from './base.js';

export class Comments extends BaseResource {
  async list(
    params: CommentListParams,
    overrides?: RequestOverrides,
  ): Promise<Comment[]> {
    return this.http.get<Comment[]>('/get_comments', {
      query: { expenseId: params.expenseId },
      unwrapKey: 'comments',
      ...overrides,
    });
  }

  async create(
    params: CommentCreateParams,
    overrides?: RequestOverrides,
  ): Promise<Comment> {
    return this.http.post<Comment>('/create_comment', {
      body: { ...params },
      unwrapKey: 'comment',
      ...overrides,
    });
  }

  async delete(
    params: CommentDeleteParams,
    overrides?: RequestOverrides,
  ): Promise<Comment> {
    return this.http.post<Comment>(`/delete_comment/${params.id}`, {
      unwrapKey: 'comment',
      ...overrides,
    });
  }
}
