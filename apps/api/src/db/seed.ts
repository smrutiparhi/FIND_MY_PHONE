import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { Pool } from 'pg';
import type { CeirRecordId, RecoveryActionId, UserId } from '@recoverai/shared';
import { env } from '../config/env';
import { logger } from '../lib/logger';
import { encryptField } from '../lib/encryption';
import { createRepositories } from './repositories';
import { runMigrations } from './migrate';

/**
 * Demo data only - fictional people, devices, and events, no real personal
 * information (master spec: "seed data containing demo users/cases without
 * real personal information"). Re-running is safe: demo rows are identified
 * by their @example.com email and deleted (cascading through every child
 * table via ON DELETE CASCADE) before being recreated.
 */
const DEMO_EMAILS = ['demo.priya@example.com', 'demo.aarav@example.com'] as const;

async function clearExistingDemoData(pool: Pool): Promise<void> {
  await pool.query('DELETE FROM users WHERE email = ANY($1::text[])', [DEMO_EMAILS]);
}

async function seedLostAndroidAtHome(pool: Pool): Promise<void> {
  const repos = createRepositories(pool);

  const user = await repos.users.create({
    id: '11111111-1111-4111-8111-111111111101' as UserId,
    email: 'demo.priya@example.com',
    fullName: 'Priya Iyer (Demo)',
  });

  const device = await repos.devices.create({
    userId: user.id,
    nickname: "Priya's Phone",
    manufacturer: 'Samsung',
    model: 'Galaxy S23',
    platform: 'ANDROID',
    phoneNumberMasked: '+91 98••••210',
    simType: 'PHYSICAL',
    carrier: 'Demo Mobile',
  });

  const recoveryCase = await repos.recoveryCases.create({
    userId: user.id,
    deviceId: device.id,
    incidentType: 'LOST',
    occurredAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
    lastSeenDescription: 'Somewhere at home, possibly the living room',
    accountAccessStatus: 'YES',
    simAccessStatus: 'ANOTHER_DEVICE_HAS_ACCESS',
    locationCapability: 'YES',
  });

  await repos.recoveryCases.update(recoveryCase.id, user.id, { status: 'LOCATING' });

  await repos.incidentAssessments.create({
    caseId: recoveryCase.id,
    screenLockEnabled: 'YES',
    sensitiveApps: ['BANKING', 'UPI'],
    deviceFindingAvailable: 'YES',
    riskLevel: 'LOW',
    riskReasons: [
      'Device-finding is available and the owner still has account access',
      'Screen lock is enabled, limiting exposure if briefly accessed by someone else',
    ],
  });
  await repos.recoveryCases.update(recoveryCase.id, user.id, { riskLevel: 'LOW' });

  const locateAction = await repos.recoveryActions.create({
    caseId: recoveryCase.id,
    type: 'LOCATE_DEVICE',
    priority: 1,
    title: 'Locate the device using Google Find Hub',
    reason: 'Device-finding is available, so start by seeing the last reported location.',
    instructions:
      'Open Google Find Hub on another device and sign in with the same Google account.',
    status: 'COMPLETED',
    officialExternalAction: {
      provider: 'google',
      label: 'Open Google Find Hub',
      url: 'https://android.com/find',
    },
  });
  const ringAction = await repos.recoveryActions.create({
    caseId: recoveryCase.id,
    type: 'RING_DEVICE',
    priority: 2,
    title: 'Ring the device to help locate it nearby',
    reason: 'The last reported location is inside the home, so ringing can help pinpoint it.',
    instructions: 'Use Find Hub\'s "Play Sound" option, even if the device is on silent.',
    status: 'IN_PROGRESS',
    dependsOnActionIds: [locateAction.id],
  });
  await repos.recoveryActions.create({
    caseId: recoveryCase.id,
    type: 'NEARBY_SEARCH',
    priority: 3,
    title: 'Search the area where the device was last active',
    reason: 'Ringing narrows down the general area for a physical search.',
    instructions:
      'Check likely spots near where the sound was heard: couch cushions, bags, coat pockets.',
    status: 'PENDING',
    dependsOnActionIds: [ringAction.id],
  });
  await repos.recoveryCases.setCurrentRecommendedAction(recoveryCase.id, user.id, ringAction.id);

  await repos.locationObservations.create({
    caseId: recoveryCase.id,
    latitude: 12.9716,
    longitude: 77.5946,
    accuracyMeters: 15,
    observedAt: new Date(Date.now() - 20 * 60 * 1000).toISOString(),
    source: 'USER_CONFIRMED',
    verificationStatus: 'USER_REPORTED',
    notes: 'Seen via Google Find Hub, appears to be inside the home',
    recordedByUserId: user.id,
  });

  await repos.timelineEvents.create({
    caseId: recoveryCase.id,
    type: 'CASE_CREATED',
    title: 'Case created',
    description: 'Lost-device case opened for Galaxy S23.',
    source: 'SYSTEM',
    verificationStatus: 'SYSTEM_VERIFIED',
  });
  await repos.timelineEvents.create({
    caseId: recoveryCase.id,
    type: 'RISK_ASSESSED',
    title: 'Risk assessed as Low',
    source: 'SYSTEM',
    verificationStatus: 'SYSTEM_VERIFIED',
  });
  await repos.timelineEvents.create({
    caseId: recoveryCase.id,
    type: 'LOCATION_OBSERVATION_RECORDED',
    title: 'Location observation recorded',
    description: 'Device confirmed inside the home via Google Find Hub.',
    source: 'USER',
    verificationStatus: 'USER_REPORTED',
  });

  logger.info({ email: user.email, caseId: recoveryCase.id }, 'Seeded: Lost Android at home');
}

async function seedStolenAndroidNoAccountAccess(pool: Pool): Promise<void> {
  const repos = createRepositories(pool);

  const user = await repos.users.create({
    id: '22222222-2222-4222-8222-222222222202' as UserId,
    email: 'demo.aarav@example.com',
    fullName: 'Aarav Mehta (Demo)',
  });

  const device = await repos.devices.create({
    userId: user.id,
    nickname: "Aarav's OnePlus",
    manufacturer: 'OnePlus',
    model: '11R',
    platform: 'ANDROID',
    phoneNumberMasked: '+91 90••••847',
    // Fictional demo IMEI, not a real device identifier.
    imei1: '490154203237518',
    simType: 'PHYSICAL',
    carrier: 'Demo Telecom',
  });

  const recoveryCase = await repos.recoveryCases.create({
    userId: user.id,
    deviceId: device.id,
    incidentType: 'STOLEN',
    occurredAt: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
    lastSeenDescription: 'Pickpocketed on a crowded train platform',
    accountAccessStatus: 'NO',
    simAccessStatus: 'LOST_WITH_PHONE',
    locationCapability: 'UNSURE',
  });

  await repos.recoveryCases.update(recoveryCase.id, user.id, { status: 'SIM_PROTECTION' });

  await repos.incidentAssessments.create({
    caseId: recoveryCase.id,
    screenLockEnabled: 'UNSURE',
    sensitiveApps: ['BANKING', 'UPI', 'EMAIL', 'AUTHENTICATOR'],
    deviceFindingAvailable: 'NO',
    riskLevel: 'CRITICAL',
    riskReasons: [
      'Device was stolen and both platform-account and SIM access are unavailable',
      'Banking, UPI, and authenticator apps are present and screen-lock status is unknown',
      'No authorized device-finding is currently available',
    ],
  });
  await repos.recoveryCases.update(recoveryCase.id, user.id, { riskLevel: 'CRITICAL' });

  const simAction = await repos.recoveryActions.create({
    caseId: recoveryCase.id,
    type: 'SIM_PROTECTION',
    priority: 1,
    title: 'Block and replace your SIM card',
    reason:
      'The SIM was lost with the phone, so it is the fastest path back to OTP-based account recovery.',
    instructions: 'Contact your carrier immediately to block the SIM and request a replacement.',
    status: 'IN_PROGRESS',
  });
  await repos.recoveryActions.create({
    caseId: recoveryCase.id,
    type: 'ACCOUNT_RECOVERY',
    priority: 2,
    title: 'Recover your Google account access',
    reason:
      'Account access is unavailable and is required to use Find Hub and secure the device remotely.',
    instructions: 'Use Google Account Recovery once your phone number is restored.',
    status: 'PENDING',
    dependsOnActionIds: [simAction.id],
    officialExternalAction: {
      provider: 'google',
      label: 'Start Google Account Recovery',
      url: 'https://accounts.google.com/signin/recovery',
    },
  });
  await repos.recoveryActions.create({
    caseId: recoveryCase.id,
    type: 'FINANCIAL_PROTECTION',
    priority: 3,
    title: 'Secure banking and UPI apps immediately',
    reason:
      'Banking and UPI apps are present and the screen-lock status is unknown - treat as high priority.',
    instructions:
      'Contact your bank and UPI provider to freeze or re-secure access from this device.',
    status: 'PENDING',
  });
  const policeAction = await repos.recoveryActions.create({
    caseId: recoveryCase.id,
    type: 'POLICE_REPORT',
    priority: 4,
    title: 'File a police complaint',
    reason: 'A police complaint is required before submitting a CEIR request.',
    instructions:
      'Use the Police Complaint Assistant to prepare a draft with your confirmed details.',
    status: 'PENDING',
  });
  await repos.recoveryActions.create({
    caseId: recoveryCase.id,
    type: 'CEIR_SUBMISSION',
    priority: 5,
    title: 'Submit a CEIR request to block the IMEI',
    reason: 'CEIR/Sanchar Saathi submission requires a filed police complaint first.',
    instructions: 'Use the CEIR Assistant once your police complaint has been filed.',
    status: 'PENDING',
    dependsOnActionIds: [policeAction.id],
  });
  await repos.recoveryCases.setCurrentRecommendedAction(recoveryCase.id, user.id, simAction.id);

  // No location observation is seeded here - device-finding is unavailable,
  // demonstrating the "current location unavailable" state (Part 8).

  await repos.timelineEvents.create({
    caseId: recoveryCase.id,
    type: 'CASE_CREATED',
    title: 'Case created',
    description: 'Stolen-device case opened for OnePlus 11R.',
    source: 'SYSTEM',
    verificationStatus: 'SYSTEM_VERIFIED',
  });
  await repos.timelineEvents.create({
    caseId: recoveryCase.id,
    type: 'RISK_ASSESSED',
    title: 'Risk assessed as Critical',
    source: 'SYSTEM',
    verificationStatus: 'SYSTEM_VERIFIED',
  });
  await repos.timelineEvents.create({
    caseId: recoveryCase.id,
    type: 'SIM_PROTECTION_STARTED',
    title: 'SIM protection started',
    recoveryActionId: simAction.id,
    source: 'USER',
    verificationStatus: 'USER_REPORTED',
  });

  await repos.notifications.create({
    userId: user.id,
    caseId: recoveryCase.id,
    type: 'CRITICAL_ACTION_PENDING',
    title: 'Critical: protect your SIM now',
    body: 'Your SIM was lost with your device. Blocking it is the fastest path to recovering account access.',
  });

  const ceir = await repos.ceirRecords.getOrCreateForCase(recoveryCase.id);
  await repos.ceirRecords.update(ceir.id as CeirRecordId, user.id, {
    status: 'NOT_READY',
    checklistCompletedItems: ['IMEI_INFORMATION', 'MOBILE_NUMBER', 'DEVICE_DETAILS'],
  });

  logger.info(
    {
      email: user.email,
      caseId: recoveryCase.id,
      currentRecommendedActionId: simAction.id satisfies RecoveryActionId,
    },
    'Seeded: Stolen Android without account access',
  );
}

async function seed(): Promise<void> {
  if (!env.DATABASE_URL) {
    throw new Error('DATABASE_URL must be configured to seed the database.');
  }
  if (!env.ENCRYPTION_KEY) {
    throw new Error(
      'ENCRYPTION_KEY must be configured to seed the database (used to encrypt demo IMEI values).',
    );
  }
  // Fails fast with a clear error if the key is malformed, before any writes happen.
  encryptField('startup-check');

  const pool = new Pool({ connectionString: env.DATABASE_URL });
  try {
    await runMigrations(pool);
    await clearExistingDemoData(pool);
    await seedLostAndroidAtHome(pool);
    await seedStolenAndroidNoAccountAccess(pool);
    logger.info('Seed complete');
  } finally {
    await pool.end();
  }
}

const isMainModule =
  process.argv[1] !== undefined && fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);

if (isMainModule) {
  seed()
    .then(() => process.exit(0))
    .catch((err: unknown) => {
      logger.error({ err }, 'Seed failed');
      process.exit(1);
    });
}
