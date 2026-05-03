import type {
  Comment,
  CommentCreateParams,
  CommentDeleteParams,
  CommentListParams,
} from '../types.js';
import { BaseResource } from './base.js';

export class Comments extends BaseResource {
  async list(params: CommentListParams): Promise<Comment[]> {
    return this.http.get<Comment[]>('/get_comments', {
      query: { expenseId: params.expenseId },
      unwrapKey: 'comments',
    });
  }

  async create(params: CommentCreateParams): Promise<Comment> {
    return this.http.post<Comment>('/create_comment', {
      body: { ...params },
      unwrapKey: 'comment',
    });
  }

  async delete(params: CommentDeleteParams): Promise<Comment> {
    return this.http.post<Comment>(`/delete_comment/${params.id}`, {
      unwrapKey: 'comment',
    });
  }
}
