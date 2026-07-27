import { describe, expect, it } from 'vitest';
import { createUserWithCase, repos } from '../factories';

describe('NotificationRepository', () => {
  it('counts unread and marks individual notifications read', async () => {
    const { user, recoveryCase } = await createUserWithCase();
    const first = await repos.notifications.create({
      userId: user.id,
      caseId: recoveryCase.id,
      type: 'CRITICAL_ACTION_PENDING',
      title: 'Protect your SIM',
      body: 'Test body',
    });
    await repos.notifications.create({
      userId: user.id,
      caseId: recoveryCase.id,
      type: 'CEIR_FOLLOWUP_REMINDER',
      title: 'CEIR follow-up',
      body: 'Test body',
    });

    await expect(repos.notifications.countUnread(user.id)).resolves.toBe(2);

    const read = await repos.notifications.markRead(first.id, user.id);
    expect(read?.isRead).toBe(true);
    expect(read?.readAt).not.toBeNull();

    await expect(repos.notifications.countUnread(user.id)).resolves.toBe(1);

    const unreadOnly = await repos.notifications.listByUser(user.id, { unreadOnly: true });
    expect(unreadOnly).toHaveLength(1);
  });

  it('marks all notifications read at once', async () => {
    const { user } = await createUserWithCase();
    await repos.notifications.create({
      userId: user.id,
      type: 'CASE_INACTIVITY',
      title: 'A',
      body: 'A',
    });
    await repos.notifications.create({
      userId: user.id,
      type: 'EVIDENCE_REMINDER',
      title: 'B',
      body: 'B',
    });

    const count = await repos.notifications.markAllRead(user.id);
    expect(count).toBe(2);
    await expect(repos.notifications.countUnread(user.id)).resolves.toBe(0);
  });
});
