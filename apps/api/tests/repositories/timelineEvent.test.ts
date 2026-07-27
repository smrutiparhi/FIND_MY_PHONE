import { describe, expect, it } from 'vitest';
import { createUserWithCase, repos } from '../factories';

describe('TimelineEventRepository', () => {
  it('returns chronological and reverse-chronological views', async () => {
    const { recoveryCase } = await createUserWithCase();
    const created = await repos.timelineEvents.create({
      caseId: recoveryCase.id,
      type: 'CASE_CREATED',
      title: 'Case created',
      source: 'SYSTEM',
    });
    const assessed = await repos.timelineEvents.create({
      caseId: recoveryCase.id,
      type: 'RISK_ASSESSED',
      title: 'Risk assessed',
      source: 'SYSTEM',
    });

    const newestFirst = await repos.timelineEvents.listByCase(recoveryCase.id, 'DESC');
    expect(newestFirst.map((e) => e.id)).toEqual([assessed.id, created.id]);

    const oldestFirst = await repos.timelineEvents.listByCase(recoveryCase.id, 'ASC');
    expect(oldestFirst.map((e) => e.id)).toEqual([created.id, assessed.id]);
  });

  it('lets the owner edit and delete only their own USER_NOTE events', async () => {
    const { user, recoveryCase } = await createUserWithCase();
    const note = await repos.timelineEvents.create({
      caseId: recoveryCase.id,
      type: 'USER_NOTE',
      title: 'Called the carrier',
      source: 'USER',
      createdByUserId: user.id,
    });

    const updated = await repos.timelineEvents.updateUserNote(note.id, user.id, {
      title: 'Called the carrier - SIM blocked',
    });
    expect(updated?.title).toBe('Called the carrier - SIM blocked');

    await expect(repos.timelineEvents.deleteUserNote(note.id, user.id)).resolves.toBe(true);
    await expect(repos.timelineEvents.findByIdForUser(note.id, user.id)).resolves.toBeNull();
  });

  it('refuses to edit or delete a system-generated event, even for the owning user', async () => {
    const { user, recoveryCase } = await createUserWithCase();
    const systemEvent = await repos.timelineEvents.create({
      caseId: recoveryCase.id,
      type: 'CASE_CREATED',
      title: 'Case created',
      source: 'SYSTEM',
      verificationStatus: 'SYSTEM_VERIFIED',
    });

    // updateUserNote/deleteUserNote both require type = 'USER_NOTE' in their WHERE
    // clause, so a system event is refused exactly as if it belonged to someone else.
    await expect(
      repos.timelineEvents.updateUserNote(systemEvent.id, user.id, { title: 'Tampered' }),
    ).resolves.toBeNull();
    await expect(repos.timelineEvents.deleteUserNote(systemEvent.id, user.id)).resolves.toBe(false);

    const stillThere = await repos.timelineEvents.findByIdForUser(systemEvent.id, user.id);
    expect(stillThere?.title).toBe('Case created');
  });

  it('distinguishes source from verification status on the same event', async () => {
    const { recoveryCase } = await createUserWithCase();
    const event = await repos.timelineEvents.create({
      caseId: recoveryCase.id,
      type: 'SIM_PROTECTION_STARTED',
      title: 'SIM protection started',
      source: 'SYSTEM',
      verificationStatus: 'USER_REPORTED',
    });

    expect(event.source).toBe('SYSTEM');
    expect(event.verificationStatus).toBe('USER_REPORTED');
  });
});
