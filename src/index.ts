// Public exports for the Splitwise SDK v2.

export { Splitwise } from './client.js';
export type { SplitwiseConfig } from './client.js';

export {
  SplitwiseError,
  SplitwiseApiError,
  SplitwiseAuthenticationError,
  SplitwiseForbiddenError,
  SplitwiseNotFoundError,
  SplitwiseValidationError,
  SplitwiseRateLimitError,
  SplitwiseServerError,
  SplitwiseConstraintError,
  SplitwiseConnectionError,
} from './errors.js';

export type {
  AuthorizationUrlParams,
  AuthorizationUrlResult,
  ExchangeCodeParams,
  OAuthToken,
} from './auth/types.js';

export type { RequestOverrides } from './http.js';
export type { PagedResult } from './pagination.js';

export type {
  // Config / logging
  Logger,
  LogLevel,
  // Shared
  Balance,
  Debt,
  Picture,
  Repayment,
  UserShare,
  // Request params
  ExpenseListParams,
  ExpenseGetParams,
  ExpenseCreateParams,
  ExpenseUpdateParams,
  ExpenseDeleteParams,
  ExpenseRestoreParams,
  CreateDebtParams,
  GroupGetParams,
  GroupCreateParams,
  GroupDeleteParams,
  GroupRestoreParams,
  AddUserToGroupParams,
  RemoveUserFromGroupParams,
  UserGetParams,
  UserUpdateParams,
  FriendGetParams,
  FriendCreateParams,
  FriendCreateMultipleParams,
  FriendDeleteParams,
  CommentListParams,
  CommentCreateParams,
  CommentDeleteParams,
  NotificationListParams,
  ParseSentenceParams,
  GetMainDataParams,
  // Responses
  User,
  CurrentUser,
  Group,
  GroupMember,
  Expense,
  ExpenseShare,
  ExpenseCategory,
  Receipt,
  Category,
  Currency,
  Comment,
  Notification,
  Friend,
  FriendGroup,
} from './types.js';
