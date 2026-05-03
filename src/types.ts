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

export interface SplitwiseConfig {
  consumerKey?: string;
  consumerSecret?: string;
  accessToken?: string;
  baseUrl?: string;
  maxRetries?: number;
  timeout?: number;
  logger?: Logger;
  logLevel?: LogLevel;
  /** Allow injecting a custom fetch implementation (useful for testing) */
  fetch?: (input: string, init?: Record<string, unknown>) => Promise<unknown>;
}

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
  friendshipId?: number;
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
  friendshipId?: number;
  details?: string;
  date?: string;
  repeatInterval?: string;
  currencyCode?: string;
  categoryId?: number;
  users?: UserShare[];
  splitEqually?: boolean;
  payment?: boolean;
}

export interface ExpenseUpdateParams {
  id: number;
  cost?: string;
  description?: string;
  groupId?: number;
  friendshipId?: number;
  details?: string;
  date?: string;
  repeatInterval?: string;
  currencyCode?: string;
  categoryId?: number;
  users?: UserShare[];
  splitEqually?: boolean;
  payment?: boolean;
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
  amount: string;
  description: string;
  groupId?: number;
  date?: string;
}

// -- Groups ------------------------------------------------------------------

// GroupListParams is intentionally empty -- no parameters needed
export type GroupListParams = Record<string, never>;

export interface GroupGetParams {
  id: number;
}

export interface GroupCreateParams {
  name: string;
  groupType?: string;
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
  userFirstName: string;
  userLastName: string;
}

export interface FriendCreateMultipleParams {
  friends: Array<{
    email: string;
    firstName: string;
    lastName: string;
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
  lastName: string;
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
  notifications?: {
    addedAsFriend?: boolean;
    addedToGroup?: boolean;
    expenseAdded?: boolean;
    expenseUpdated?: boolean;
    bills?: boolean;
    payments?: boolean;
    monthlyNewsletter?: boolean;
    announcedExpenses?: boolean;
  };
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

export interface Group {
  id: number;
  name: string;
  groupType?: string;
  updatedAt?: string;
  simplifyByDefault?: boolean;
  members?: GroupMember[];
  originalDebts?: Debt[];
  simplifiedDebts?: Debt[];
  whiteboard?: string | null;
  inviteLink?: string;
  avatar?: Picture;
  customAvatar?: boolean;
  coverPhoto?: Picture;
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
  transactionConfirmed?: boolean;
  cost: string;
  currencyCode: string;
  repayments?: Repayment[];
  date: string;
  createdAt: string;
  createdBy: User;
  updatedAt?: string;
  updatedBy?: User | null;
  deletedAt?: string | null;
  deletedBy?: User | null;
  category?: ExpenseCategory;
  receipt?: Receipt;
  users?: ExpenseShare[];
}

// -- Categories --------------------------------------------------------------

export interface CategoryIconTypes {
  square?: Picture;
  slim?: Picture;
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

export interface Notification {
  id: number;
  type?: number;
  createdAt: string;
  createdBy?: number;
  source?: User | null;
  imageUrl?: string;
  imageShape?: string;
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
