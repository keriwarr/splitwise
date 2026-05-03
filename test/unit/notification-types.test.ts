import { describe, expect, it } from 'vitest';
import {
  NotificationType,
  notificationTypeName,
} from '../../src/notification-types.js';

describe('NotificationType constants', () => {
  it('matches the values used by other Splitwise SDKs', () => {
    expect(NotificationType.ExpenseAdded).toBe(0);
    expect(NotificationType.ExpenseUpdated).toBe(1);
    expect(NotificationType.ExpenseDeleted).toBe(2);
    expect(NotificationType.CommentAdded).toBe(3);
    expect(NotificationType.AddedToGroup).toBe(4);
    expect(NotificationType.RemovedFromGroup).toBe(5);
    expect(NotificationType.GroupDeleted).toBe(6);
    expect(NotificationType.GroupSettingsChanged).toBe(7);
    expect(NotificationType.AddedAsFriend).toBe(8);
    expect(NotificationType.RemovedAsFriend).toBe(9);
    expect(NotificationType.News).toBe(10);
    expect(NotificationType.DebtSimplification).toBe(11);
    expect(NotificationType.GroupUndeleted).toBe(12);
    expect(NotificationType.ExpenseUndeleted).toBe(13);
    expect(NotificationType.GroupCurrencyConversion).toBe(14);
    expect(NotificationType.FriendCurrencyConversion).toBe(15);
  });
});

describe('notificationTypeName', () => {
  it('returns the snake_case name for a known type', () => {
    expect(notificationTypeName(0)).toBe('expense_added');
    expect(notificationTypeName(3)).toBe('comment_added');
    expect(notificationTypeName(15)).toBe('friend_currency_conversion');
  });

  it('returns undefined for unknown values', () => {
    expect(notificationTypeName(999)).toBeUndefined();
    expect(notificationTypeName(-1)).toBeUndefined();
  });
});
