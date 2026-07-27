import { describe, expect, it } from 'vitest';
import { createUserWithCase, repos } from '../factories';

describe('PoliceReportRepository', () => {
  it('creates version 1 automatically and appends a new version on every draft update', async () => {
    const { user, recoveryCase } = await createUserWithCase();
    const report = await repos.policeReports.create({
      caseId: recoveryCase.id,
      createdByUserId: user.id,
      ownerFullName: 'Test Owner',
      ownerContact: 'owner@example.com',
      incidentDescription: 'Phone went missing on a train platform.',
      deviceDescriptionSnapshot: 'TestCo Model X, IMEI available',
      draftText: 'First draft.',
    });

    let versions = await repos.policeReports.listVersions(report.id);
    expect(versions).toHaveLength(1);
    expect(versions[0]?.versionNumber).toBe(1);

    const updated = await repos.policeReports.updateDraft(
      report.id,
      user.id,
      'Second draft with more detail.',
    );
    expect(updated?.draftText).toBe('Second draft with more detail.');
    expect(updated?.status).toBe('DRAFT');

    versions = await repos.policeReports.listVersions(report.id);
    expect(versions.map((v) => v.versionNumber)).toEqual([2, 1]);
  });

  it('never claims submission - approve and markUserSubmitted only ever set user-attested statuses', async () => {
    const { user, recoveryCase } = await createUserWithCase();
    const report = await repos.policeReports.create({
      caseId: recoveryCase.id,
      createdByUserId: user.id,
      ownerFullName: 'Test Owner',
      ownerContact: 'owner@example.com',
      incidentDescription: 'Phone went missing.',
      deviceDescriptionSnapshot: 'TestCo Model X',
      draftText: 'Draft complaint text.',
    });

    const approved = await repos.policeReports.approve(report.id, user.id);
    expect(approved?.status).toBe('APPROVED');
    expect(approved?.approvedAt).not.toBeNull();

    const submitted = await repos.policeReports.markUserSubmitted(
      report.id,
      user.id,
      'FIR-2026-00123',
    );
    expect(submitted?.status).toBe('USER_MARKED_SUBMITTED');
    expect(submitted?.userMarkedSubmittedAt).not.toBeNull();
    expect(submitted?.externalReferenceNumber).toBe('FIR-2026-00123');
  });
});
