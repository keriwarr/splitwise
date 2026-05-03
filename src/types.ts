// ---------------------------------------------------------------------------
// Splitwise SDK v2 - Type Definitions
//
// All types use camelCase. The SDK handles conversion to/from the API's
// snake_case at the HTTP boundary. Monetary amounts are strings (e.g. "25.00")
// to match what the Splitwise API returns.
// ---------------------------------------------------------------------------

// ===== Configuration & Logging ==============================================

export type LogLevel = 'none' | 'error' | 'warn' | 'info' | 'debug';

export interface Logger {
  debug(msg: string): void;
  info(msg: string): void;
  warn(msg: string): void;
  error(msg: string): void;
}

// `SplitwiseConfig` is defined in `client.ts` so the canonical type lives next
// to the constructor that consumes it.

// ===== Shared / Helper Types ================================================

export interface UserShare {
  userId: number;
  paidShare?: string;
  owedShare?: string;
  firstName?: string;
  lastName?: string;
  email?: string;
}

export interface Picture {
  small?: string;
  medium?: string;
  large?: string;
}

export interface Balance {
  currencyCode: string;
  amount: string;
}

export interface Repayment {
  from: number;
  to: number;
  amount: string;
}

export interface Debt {
  from: number;
  to: number;
  amount: string;
  currencyCode: string;
}

// ===== Request Parameter Types ==============================================

// -- Expenses ----------------------------------------------------------------

export interface ExpenseListParams {
  groupId?: number;
  // The query parameter is `friend_id` per OpenAPI; v1 SDK incorrectly used
  // `friendship_id` so filter-by-friend has been broken since v1.
  friendId?: number;
  datedAfter?: string;
  datedBefore?: string;
  updatedAfter?: string;
  updatedBefore?: string;
  limit?: number;
  offset?: number;
  visible?: boolean;
}

export interface ExpenseGetParams {
  id: number;
}

export interface ExpenseCreateParams {
  cost: string;
  description: string;
  groupId?: number;
  /** Not documented in OpenAPI for create_expense; v1 supported it for
   *  non-group debts. Smoke-test before relying on it. */
  friendId?: number;
  details?: string;
  date?: string;
  repeatInterval?: string;
  currencyCode?: string;
  categoryId?: number;
  users?: UserShare[];
  splitEqually?: boolean;
  payment?: boolean;
  /** Tag for how the expense was created (e.g. "equal"). Undocumented. */
  creationMethod?: string;
  /**
   * Optional receipt image. When provided, the request is sent as
   * multipart/form-data instead of form-urlencoded. Pass a `Blob` (works in
   * Node 18+, browsers, and other modern runtimes); in browsers a `File`
   * (which extends Blob) also works.
   */
  receipt?: Blob;
}

export interface ExpenseUpdateParams {
  id: number;
  cost?: string;
  description?: string;
  groupId?: number;
  friendId?: number;
  details?: string;
  date?: string;
  repeatInterval?: string;
  currencyCode?: string;
  categoryId?: number;
  users?: UserShare[];
  // Note: split_equally is NOT supported by /update_expense; the API
  // returns "Unrecognized parameter `split_equally`" 400.
  payment?: boolean;
  expenseBundleId?: number;
}

export interface ExpenseDeleteParams {
  id: number;
}

export interface ExpenseRestoreParams {
  id: number;
}

export interface CreateDebtParams {
  from: number;
  to: number;
  amount: string | number;
  description?: string;
  groupId?: number;
  date?: string;
}

// -- Groups ------------------------------------------------------------------

// GroupListParams is intentionally empty -- no parameters needed
export type GroupListParams = Record<string, never>;

export interface GroupGetParams {
  id: number;
}

export type GroupType =
  | 'home'
  | 'trip'
  | 'couple'
  | 'other'
  | 'apartment'
  | 'house';

export interface GroupCreateParams {
  name: string;
  groupType?: GroupType | string;
  /** Whether the group should simplify debts. */
  simplifyByDefault?: boolean;
  /** Undocumented in OpenAPI but supported by v1. */
  countryCode?: string;
  users?: Array<{
    userId?: number;
    firstName?: string;
    lastName?: string;
    email?: string;
  }>;
}

export interface GroupDeleteParams {
  id: number;
}

export interface GroupRestoreParams {
  id: number;
}

export interface AddUserToGroupParams {
  groupId: number;
  userId?: number;
  email?: string;
  firstName?: string;
  lastName?: string;
}

export interface RemoveUserFromGroupParams {
  groupId: number;
  userId: number;
}

// -- Users -------------------------------------------------------------------

export interface UserGetParams {
  id: number;
}

export interface UserUpdateParams {
  id: number;
  firstName?: string;
  lastName?: string;
  email?: string;
  password?: string;
  locale?: string;
  dateFormat?: string;
  defaultCurrency?: string;
  defaultGroupId?: number;
  notificationSettings?: Record<string, boolean>;
}

// -- Friends -----------------------------------------------------------------

export interface FriendGetParams {
  id: number;
}

export interface FriendCreateParams {
  userEmail: string;
  userFirstName?: string;
  userLastName?: string;
}

export interface FriendCreateMultipleParams {
  friends: Array<{
    email: string;
    firstName?: string;
    lastName?: string;
  }>;
}

export interface FriendDeleteParams {
  id: number;
}

// -- Comments ----------------------------------------------------------------

export interface CommentListParams {
  expenseId: number;
}

export interface CommentCreateParams {
  expenseId: number;
  content: string;
}

export interface CommentDeleteParams {
  id: number;
}

// -- Notifications -----------------------------------------------------------

export interface NotificationListParams {
  updatedAfter?: string;
  limit?: number;
}

// -- Misc --------------------------------------------------------------------

export interface ParseSentenceParams {
  input: string;
  groupId?: number;
  friendId?: number;
  /** If true, the parsed expense is auto-saved by Splitwise. */
  autosave?: boolean;
}

/** Response from /parse_sentence (undocumented endpoint; shape confirmed
 *  empirically by other-language SDKs). */
export interface ParseSentenceResponse {
  expense?: Expense;
  valid?: boolean;
  confidence?: number;
  error?: string;
}

export interface GetMainDataParams {
  noExpenses?: boolean;
  limit?: number;
  cachebust?: boolean;
}

// ===== Response Types =======================================================

// -- Users -------------------------------------------------------------------

export interface User {
  id: number;
  firstName: string;
  /** May be null on the API; some accounts have first name only. */
  lastName: string | null;
  email?: string;
  registrationStatus?: string;
  picture?: Picture;
  customPicture?: boolean;
  defaultCurrency?: string;
  locale?: string;
}

export interface CurrentUser extends User {
  email: string;
  defaultCurrency: string;
  locale: string;
  dateFormat?: string;
  defaultGroupId?: number;
  notificationsRead?: string;
  notificationsCount?: number;
  /** Per OpenAPI this is an open-ended bag of boolean flags; new keys may
   *  appear without notice. */
  notifications?: Record<string, boolean>;
  /** Undocumented but present on /get_current_user. */
  countryCode?: string;
  forceRefreshAt?: string | null;
  addFriendUrl?: string;
}

// -- Groups ------------------------------------------------------------------

export interface GroupMember {
  id: number;
  firstName: string;
  lastName: string;
  email?: string;
  registrationStatus?: string;
  picture?: Picture;
  customPicture?: boolean;
  balance: Balance[];
}

export interface GroupAvatar {
  original?: string | null;
  xxlarge?: string | null;
  xlarge?: string | null;
  large?: string | null;
  medium?: string | null;
  small?: string | null;
}

export interface GroupCoverPhoto {
  xxlarge?: string | null;
  xlarge?: string | null;
}

export interface Group {
  id: number;
  name: string;
  groupType?: string;
  createdAt?: string;
  updatedAt?: string;
  simplifyByDefault?: boolean;
  members?: GroupMember[];
  originalDebts?: Debt[];
  simplifiedDebts?: Debt[];
  /** Undocumented in OpenAPI but present on responses. */
  whiteboard?: string | null;
  /** Undocumented; tracks optimistic-concurrency for whiteboard updates. */
  whiteboardLockVersion?: number;
  whiteboardUpdatedAt?: string | null;
  whiteboardUpdatedBy?: number | null;
  /** Undocumented; null when no group reminders are configured. */
  groupReminders?: unknown | null;
  inviteLink?: string;
  avatar?: GroupAvatar;
  /** Undocumented variant returned alongside `avatar`. */
  tallAvatar?: { xlarge?: string; large?: string };
  customAvatar?: boolean;
  coverPhoto?: GroupCoverPhoto;
}

// -- Expenses ----------------------------------------------------------------

export interface ExpenseCategory {
  id: number;
  name: string;
}

export interface Receipt {
  large?: string | null;
  original?: string | null;
}

export interface ExpenseShare {
  user: User;
  userId: number;
  paidShare: string;
  owedShare: string;
  netBalance: string;
}

export interface Expense {
  id: number;
  groupId: number | null;
  /** Spec field name is `friendship_id` (singular friendship, not `friend_id`). */
  friendshipId?: number | null;
  expenseBundleId?: number | null;
  description: string;
  repeats: boolean;
  repeatInterval?: string | null;
  emailReminder?: boolean;
  emailReminderInAdvance?: number | null;
  nextRepeat?: string | null;
  details?: string | null;
  commentsCount?: number;
  payment: boolean;
  /** Undocumented in OpenAPI but present in responses. */
  creationMethod?: string | null;
  /** Undocumented in OpenAPI but present in responses (e.g. for payments). */
  transactionMethod?: string | null;
  transactionConfirmed?: boolean;
  transactionId?: string | null;
  transactionStatus?: string | null;
  cost: string;
  currencyCode: string;
  repayments?: Repayment[];
  date: string;
  createdAt: string;
  createdBy?: User | null;
  updatedAt?: string;
  updatedBy?: User | null;
  deletedAt?: string | null;
  deletedBy?: User | null;
  category?: ExpenseCategory;
  receipt?: Receipt;
  users?: ExpenseShare[];
  comments?: Comment[];
}

// -- Categories --------------------------------------------------------------

export interface CategoryIconTypes {
  /** Per OpenAPI the API returns `large` and `xlarge` here, not the standard
   *  small/medium/large picture sizes. */
  square?: { large?: string; xlarge?: string };
  slim?: { small?: string; large?: string };
  /** Undocumented but present in real responses. */
  transparent?: { large?: string; xlarge?: string };
}

export interface Category {
  id: number;
  name: string;
  icon?: string;
  iconTypes?: CategoryIconTypes;
  subcategories?: Category[];
}

// -- Currencies --------------------------------------------------------------

export interface Currency {
  currencyCode: string;
  unit: string;
}

// -- Comments ----------------------------------------------------------------

export interface Comment {
  id: number;
  content: string;
  commentType: string;
  relationType: string;
  relationId: number;
  createdAt: string;
  deletedAt?: string | null;
  user?: User;
}

// -- Notifications -----------------------------------------------------------

export interface NotificationSource {
  /** e.g. "Expense", "Group", "Friendship". */
  type: string;
  id: number;
  url?: string | null;
}

export interface Notification {
  id: number;
  type?: number;
  createdAt: string;
  createdBy?: number;
  source?: NotificationSource | null;
  imageUrl?: string;
  imageShape?: 'square' | 'circle' | string;
  content?: string;
}

// -- Friends -----------------------------------------------------------------

export interface FriendGroup {
  groupId: number;
  balance: Balance[];
}

export interface Friend {
  id: number;
  firstName: string;
  lastName: string;
  email?: string;
  registrationStatus?: string;
  picture?: Picture;
  customPicture?: boolean;
  balance: Balance[];
  groups: FriendGroup[];
  updatedAt?: string;
}
