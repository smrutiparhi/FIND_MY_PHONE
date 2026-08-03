import type { Pool } from 'pg';
import type { DemoState, RecoveryCaseId, UserId } from '@recoverai/shared';
import { DEMO_STAGE_COUNT, DEMO_STAGE_LABELS } from '@recoverai/shared';
import { createRepositories } from '../../db/repositories';
import { ForbiddenError, NotFoundError } from '../../lib/errors';
import { applyEngineResult } from '../recoveryEngine/applyEngineResult';
import { buildEngineInputForNewCase } from '../recoveryEngine/buildEngineInputForNewCase';
import { evaluateRecoveryDecision } from '../recoveryEngine/evaluateRecoveryDecision';
import { recalculateRecoveryCase } from '../recoveryEngine/recalculateRecoveryCase';
import { toRecoveryPlan } from '../recoveryEngine/toRecoveryPlan';
import { updateSimProtectionRecord } from '../simProtection/updateSimProtectionRecord';
import { updateCeirRecord } from '../ceir/ceirService';
import { approvePoliceReport, createPoliceReport, markPoliceReportSubmitted } from '../policeReport/policeReportService';
import { updateDeviceRecoveryChecklist } from '../deviceRecovery/deviceRecoveryService';

/**
 * Part 22 (Demo Mode). The master spec's own worked example ("Android
 * stolen at Hyderabad Metro") and exact 10-stage presentation flow, driven
 * through the *same* service functions every real page already uses -
 * a portfolio demo should show the real product working, not a mockup.
 * Every stage is idempotent (safe to call again on an already-completed
 * stage) so re-entering the flow, refreshing mid-demo, or double-clicking
 * "Next" never errors or duplicates data.
 */

/** Coordinates are a deliberately fictional point near Hyderabad's MG Bus Station metro interchange - never a real user's data. */
const DEMO_LATITUDE = 17.3838;
const DEMO_LONGITUDE = 78.4813;

async function assertDemoCase(repos: ReturnType<typeof createRepositories>, userId: UserId, caseId: RecoveryCaseId) {
  const recoveryCase = await repos.recoveryCases.findById(caseId, userId);
  if (!recoveryCase) throw new NotFoundError('Demo case not found');
  if (!recoveryCase.isDemo) {
    // Never let the demo-advancement machinery touch a real case, even if a real caseId is
    // somehow passed in - "Demo Mode must never be confused with real recovery operations."
    throw new ForbiddenError('This endpoint only operates on demo cases');
  }
  return recoveryCase;
}

async function buildState(pool: Pool, userId: UserId, caseId: RecoveryCaseId, stage: number): Promise<DemoState> {
  const repos = createRepositories(pool);
  const recoveryCase = await repos.recoveryCases.findById(caseId, userId);
  if (!recoveryCase) throw new NotFoundError('Demo case not found');
  const { engineResult, actionIdByType } = await recalculateRecoveryCase(pool, userId, caseId);
  return {
    recoveryCase,
    recoveryPlan: toRecoveryPlan(engineResult, actionIdByType),
    stage,
    stageLabel: DEMO_STAGE_LABELS[stage - 1] ?? DEMO_STAGE_LABELS[0],
    isFinalStage: stage >= DEMO_STAGE_COUNT,
  };
}

/**
 * Derives how far an existing demo case has already progressed, so
 * re-entering /demo after a refresh resumes instead of restarting -
 * checked in the same order the stages themselves run.
 */
async function deriveCurrentStage(pool: Pool, userId: UserId, caseId: RecoveryCaseId): Promise<number> {
  const repos = createRepositories(pool);
  const recoveryCase = await repos.recoveryCases.findById(caseId, userId);
  if (!recoveryCase) throw new NotFoundError('Demo case not found');
  if (recoveryCase.status === 'RECOVERED' || recoveryCase.status === 'CLOSED') return 10;

  const checklist = await repos.deviceRecoveryChecklists.findByCase(caseId);
  if (checklist?.completedItems.includes('CONFIRM_POSSESSION')) return 10;

  const ceir = await repos.ceirRecords.findByCase(caseId);
  if (ceir && ceir.status !== 'NOT_READY' && ceir.status !== 'READY') return 9;

  const policeReports = await repos.policeReports.listByCase(caseId);
  if (policeReports.some((r) => r.status === 'USER_MARKED_SUBMITTED')) return 8;

  const sim = await repos.simProtectionRecords.findByCase(caseId);
  if (sim?.status === 'BLOCKED') return 7;

  const actions = await repos.recoveryActions.listByCase(caseId);
  const secureAction = actions.find((a) => a.type === 'SECURE_DEVICE');
  if (secureAction && secureAction.status === 'COMPLETED') return 6;

  const locations = await repos.locationObservations.listByCase(caseId);
  if (locations.length > 0) return secureAction ? 5 : 6;

  return 2;
}

/** Reuses an existing active demo case if one exists (resumed at its real progress), otherwise creates a fresh one. */
export async function startOrResumeDemoCase(pool: Pool, userId: UserId): Promise<DemoState> {
  const repos = createRepositories(pool);
  const existing = await repos.recoveryCases.findActiveDemoCase(userId);
  if (existing) {
    const stage = await deriveCurrentStage(pool, userId, existing.id);
    return buildState(pool, userId, existing.id, stage);
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const txRepos = createRepositories(client);

    const device = await txRepos.devices.create({
      userId,
      nickname: 'Demo Galaxy S23',
      manufacturer: 'Samsung',
      model: 'Galaxy S23',
      platform: 'ANDROID',
    });

    const recoveryCase = await txRepos.recoveryCases.create({
      userId,
      deviceId: device.id,
      incidentType: 'STOLEN',
      lastSeenDescription: 'Snatched from my hand while boarding at Hyderabad Metro, MG Bus Station.',
      accountAccessStatus: 'NO',
      simAccessStatus: 'LOST_WITH_PHONE',
      locationCapability: 'YES',
      isDemo: true,
    });

    const wizardShape = {
      incidentType: 'STOLEN' as const,
      device: { mode: 'existing' as const, deviceId: device.id },
      lastSeenAt: null,
      lastSeenDescription: recoveryCase.lastSeenDescription,
      accountAccessStatus: 'NO' as const,
      simAccessStatus: 'LOST_WITH_PHONE' as const,
      screenLockEnabled: 'NO' as const,
      sensitiveApps: ['UPI' as const, 'BANKING' as const],
      deviceFindingAvailable: 'YES' as const,
    };
    const engineInput = buildEngineInputForNewCase(wizardShape, device.platform);
    const engineResult = evaluateRecoveryDecision(engineInput);
    await applyEngineResult(txRepos, userId, recoveryCase.id, engineInput, engineResult, [], wizardShape.sensitiveApps);

    await txRepos.timelineEvents.create({
      caseId: recoveryCase.id,
      type: 'CASE_CREATED',
      title: 'Case created (DEMO DATA)',
      description: 'Fictional demo case opened for RecoverAI Demo Mode - not a real incident.',
      source: 'USER',
      verificationStatus: 'USER_REPORTED',
      createdByUserId: userId,
    });

    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }

  const created = await repos.recoveryCases.findActiveDemoCase(userId);
  if (!created) throw new Error('Demo case creation did not persist');
  return buildState(pool, userId, created.id, 2);
}

async function performStageAction(pool: Pool, userId: UserId, caseId: RecoveryCaseId, stage: number): Promise<void> {
  const repos = createRepositories(pool);

  if (stage === 3) {
    const existing = await repos.locationObservations.listByCase(caseId);
    if (existing.length === 0) {
      await repos.locationObservations.create({
        caseId,
        latitude: DEMO_LATITUDE,
        longitude: DEMO_LONGITUDE,
        accuracyMeters: 35,
        observedAt: new Date().toISOString(),
        source: 'USER_ENTERED',
        verificationStatus: 'USER_REPORTED',
        notes: 'Last seen near Hyderabad Metro, MG Bus Station - DEMO DATA, not a real location.',
        recordedByUserId: userId,
      });
      await repos.timelineEvents.create({
        caseId,
        type: 'LOCATION_OBSERVATION_RECORDED',
        title: 'Location observation recorded (DEMO DATA)',
        description: 'Simulated last-seen location added for the demo walkthrough.',
        source: 'USER',
        verificationStatus: 'USER_REPORTED',
        createdByUserId: userId,
      });
    }
    return;
  }

  if (stage === 5) {
    const actions = await repos.recoveryActions.listByCase(caseId);
    const secureAction = actions.find((a) => a.type === 'SECURE_DEVICE');
    if (secureAction && secureAction.status !== 'COMPLETED') {
      await repos.recoveryActions.updateStatus(secureAction.id, userId, 'COMPLETED');
      await repos.timelineEvents.create({
        caseId,
        type: 'DEVICE_SECURED',
        title: 'Device secured remotely (DEMO DATA)',
        description: 'Simulated remote lock via Find Hub for the demo walkthrough.',
        source: 'USER',
        verificationStatus: 'USER_REPORTED',
        createdByUserId: userId,
      });
    }
    return;
  }

  if (stage === 6) {
    const sim = await repos.simProtectionRecords.getOrCreateForCase(caseId);
    if (sim.status === 'ACTIVE' || sim.status === 'UNKNOWN') {
      await updateSimProtectionRecord(pool, userId, caseId, { status: 'BLOCK_REQUESTED' });
    }
    const afterRequest = await repos.simProtectionRecords.getOrCreateForCase(caseId);
    if (afterRequest.status !== 'BLOCKED' && afterRequest.status !== 'REPLACED') {
      await updateSimProtectionRecord(pool, userId, caseId, { status: 'BLOCKED' });
    }
    return;
  }

  if (stage === 7) {
    const existingReports = await repos.policeReports.listByCase(caseId);
    let report = existingReports[0] ?? null;
    if (!report) {
      const state = await createPoliceReport(pool, userId, caseId, {
        ownerFullName: 'Demo User',
        ownerContact: 'demo.walkthrough@example.com',
        incidentDescription:
          'My phone was snatched from my hand while I was boarding a train at Hyderabad Metro, MG Bus Station, during evening rush hour.',
      });
      report = state.report;
    }
    if (report.status === 'DRAFT') {
      await approvePoliceReport(pool, userId, caseId, report.id);
    }
    const current = (await repos.policeReports.findByIdForUser(report.id, userId)) ?? report;
    if (current.status !== 'USER_MARKED_SUBMITTED') {
      await markPoliceReportSubmitted(pool, userId, caseId, report.id, { externalReferenceNumber: 'DEMO-FIR-000001' });
    }
    return;
  }

  if (stage === 8) {
    const ceir = await repos.ceirRecords.getOrCreateForCase(caseId);
    if (ceir.status === 'NOT_READY' || ceir.status === 'READY') {
      await updateCeirRecord(pool, userId, caseId, { status: 'SUBMITTED', ceirRequestId: 'CEIR-DEMO-000001' });
    }
    const afterSubmit = await repos.ceirRecords.getOrCreateForCase(caseId);
    if (afterSubmit.status === 'SUBMITTED') {
      await updateCeirRecord(pool, userId, caseId, { status: 'PROCESSING' });
    }
    return;
  }

  if (stage === 10) {
    const checklist = await repos.deviceRecoveryChecklists.getOrCreateForCase(caseId);
    if (!checklist.completedItems.includes('CONFIRM_POSSESSION')) {
      await updateDeviceRecoveryChecklist(pool, userId, caseId, {
        completedItems: [...checklist.completedItems, 'CONFIRM_POSSESSION'],
      });
    }
    return;
  }

  // Stages 1, 2, 4, 9 have no write of their own - they're views over state the earlier
  // stages (or case creation itself) already produced.
}

export async function advanceDemoCase(pool: Pool, userId: UserId, caseId: RecoveryCaseId, targetStage: number): Promise<DemoState> {
  const repos = createRepositories(pool);
  await assertDemoCase(repos, userId, caseId);

  const clampedStage = Math.min(Math.max(targetStage, 1), DEMO_STAGE_COUNT);
  await performStageAction(pool, userId, caseId, clampedStage);
  return buildState(pool, userId, caseId, clampedStage);
}

export async function getDemoState(pool: Pool, userId: UserId, caseId: RecoveryCaseId): Promise<DemoState> {
  const repos = createRepositories(pool);
  await assertDemoCase(repos, userId, caseId);
  const stage = await deriveCurrentStage(pool, userId, caseId);
  return buildState(pool, userId, caseId, stage);
}

/** Lets the presenter restart with a clean slate - deletes the demo case (and, via cascade, every row it owns) plus its dedicated demo device. */
export async function resetDemoCase(pool: Pool, userId: UserId, caseId: RecoveryCaseId): Promise<void> {
  const repos = createRepositories(pool);
  const recoveryCase = await assertDemoCase(repos, userId, caseId);
  const deviceId = recoveryCase.deviceId;
  const deleted = await repos.recoveryCases.deleteDemoCase(caseId, userId);
  if (!deleted) throw new NotFoundError('Demo case not found');
  await repos.devices.delete(deviceId, userId).catch(() => {
    /* best-effort - a leftover demo device is harmless */
  });
}
