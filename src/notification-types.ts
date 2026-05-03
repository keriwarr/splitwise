/**
 * Splitwise notification type values.
 *
 * The API returns notification.type as a small integer. The mapping below was
 * derived from the Rust SDK (pbar1/splitwise-rs), which appears to be the
 * most thoroughly enumerated reference. Splitwise's official OpenAPI spec
 * doesn't enumerate the values.
 *
 * **Note:** Splitwise may add new notification types without warning. Treat
 * `Notification.type` as `number` and use these constants for comparison;
 * unknown values should be handled gracefully (e.g. fall through to a default
 * branch in a switch).
 */
export const NotificationType = {
  ExpenseAdded: 0,
  ExpenseUpdated: 1,
  ExpenseDeleted: 2,
  CommentAdded: 3,
  AddedToGroup: 4,
  RemovedFromGroup: 5,
  GroupDeleted: 6,
  GroupSettingsChanged: 7,
  AddedAsFriend: 8,
  RemovedAsFriend: 9,
  News: 10,
  DebtSimplification: 11,
  GroupUndeleted: 12,
  ExpenseUndeleted: 13,
  GroupCurrencyConversion: 14,
  FriendCurrencyConversion: 15,
} as const;

/** Union of all known notification type IDs. */
export type NotificationTypeId =
  (typeof NotificationType)[keyof typeof NotificationType];

const NAMES: Record<number, string> = {
  [NotificationType.ExpenseAdded]: 'expense_added',
  [NotificationType.ExpenseUpdated]: 'expense_updated',
  [NotificationType.ExpenseDeleted]: 'expense_deleted',
  [NotificationType.CommentAdded]: 'comment_added',
  [NotificationType.AddedToGroup]: 'added_to_group',
  [NotificationType.RemovedFromGroup]: 'removed_from_group',
  [NotificationType.GroupDeleted]: 'group_deleted',
  [NotificationType.GroupSettingsChanged]: 'group_settings_changed',
  [NotificationType.AddedAsFriend]: 'added_as_friend',
  [NotificationType.RemovedAsFriend]: 'removed_as_friend',
  [NotificationType.News]: 'news',
  [NotificationType.DebtSimplification]: 'debt_simplification',
  [NotificationType.GroupUndeleted]: 'group_undeleted',
  [NotificationType.ExpenseUndeleted]: 'expense_undeleted',
  [NotificationType.GroupCurrencyConversion]: 'group_currency_conversion',
  [NotificationType.FriendCurrencyConversion]: 'friend_currency_conversion',
};

/**
 * Returns the snake_case name for a notification type id, or `undefined` if
 * the id is unknown. Useful for logging and switch-style branching:
 *
 * @example
 * ```ts
 * switch (notificationTypeName(notification.type)) {
 *   case 'expense_added': ...
 *   case 'comment_added': ...
 *   default: ...  // including unknown future values
 * }
 * ```
 */
export function notificationTypeName(typeId: number): string | undefined {
  return NAMES[typeId];
}
