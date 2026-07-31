import type { Pool } from 'pg';
import type {
  CreatePoliceReportInput,
  LocationObservation,
  MarkPoliceReportSubmittedInput,
  PoliceReportId,
  PoliceReportState,
  RecoveryCaseId,
  RegeneratePoliceReportDraftInput,
  UpdatePoliceReportDraftInput,
  UserId,
} from '@recoverai/shared';
import type { Repositories } from '../../db/repositories';
import { createRepositories } from '../../db/repositories';
import { NotFoundError } from '../../lib/errors';
import { recalculateRecoveryCase } from '../recoveryEngine/recalculateRecoveryCase';
import { buildDeviceDescriptionSnapshot } from './buildDeviceDescriptionSnapshot';
import { generatePoliceComplaintDraft } from './generatePoliceComplaintDraft';
import type { PoliceComplaintFacts } from './policeComplaintFacts';

function formatLocationObservationSummary(observation: LocationObservation | null): string | null {
  if (!observation) return null;
  return `Observed ${observation.observedAt}, source ${observation.source} (verification: ${observation.verificationStatus}), coordinates ${observation.latitude}, ${observation.longitude}${observation.accuracyMeters ? ` (+/- ${observation.accuracyMeters}m)` : ''}.`;
}

async function loadState(repos: Repositories, userId: UserId, reportId: PoliceReportId): Promise<PoliceReportState> {
  const report = await repos.policeReports.findByIdForUser(reportId, userId);
  if (!report) throw new NotFoundError('Police report not found');
  const versions = await repos.policeReports.listVersions(reportId);
  return { report, versions, isSimulated: versions[0]?.isSimulated ?? false };
}

async function gatherFacts(
  repos: Repositories,
  userId: UserId,
  caseId: RecoveryCaseId,
  input: CreatePoliceReportInput,
): Promise<PoliceComplaintFacts> {
  const recoveryCase = await repos.recoveryCases.findById(caseId, userId);
  if (!recoveryCase) throw new NotFoundError('Recovery case not found');
  const device = await repos.devices.findById(recoveryCase.deviceId, userId);
  if (!device) throw new NotFoundError('Device not found');

  const [deviceFacts, latestLocation] = await Promise.all([
    buildDeviceDescriptionSnapshot(repos, device, userId),
    repos.locationObservations.findLatestByCase(caseId),
  ]);

  return {
    ownerFullName: input.ownerFullName,
    ownerContact: input.ownerContact,
    incidentType: recoveryCase.incidentType,
    incidentDateTime: input.incidentDateTime ?? null,
    lastKnownPlace: input.lastKnownPlace ?? null,
    incidentDescription: input.incidentDescription,
    deviceDescriptionSnapshot: deviceFacts.snapshot,
    imei1: deviceFacts.imei1,
    imei2: deviceFacts.imei2,
    serialNumber: deviceFacts.serialNumber,
    locationObservationSummary: formatLocationObservationSummary(latestLocation),
  };
}

export async function listPoliceReportsForCase(pool: Pool, userId: UserId, caseId: RecoveryCaseId) {
  const repos = createRepositories(pool);
  const recoveryCase = await repos.recoveryCases.findById(caseId, userId);
  if (!recoveryCase) throw new NotFoundError('Recovery case not found');
  return repos.policeReports.listByCase(caseId);
}

export async function getPoliceReportState(
  pool: Pool,
  userId: UserId,
  caseId: RecoveryCaseId,
  reportId: PoliceReportId,
): Promise<PoliceReportState> {
  const repos = createRepositories(pool);
  const recoveryCase = await repos.recoveryCases.findById(caseId, userId);
  if (!recoveryCase) throw new NotFoundError('Recovery case not found');
  const state = await loadState(repos, userId, reportId);
  if (state.report.caseId !== caseId) throw new NotFoundError('Police report not found');
  return state;
}

export async function createPoliceReport(
  pool: Pool,
  userId: UserId,
  caseId: RecoveryCaseId,
  input: CreatePoliceReportInput,
): Promise<PoliceReportState> {
  const repos = createRepositories(pool);
  const facts = await gatherFacts(repos, userId, caseId, input);
  const generated = await generatePoliceComplaintDraft(facts);

  const report = await repos.policeReports.create({
    caseId,
    createdByUserId: userId,
    ownerFullName: input.ownerFullName,
    ownerContact: input.ownerContact,
    incidentDateTime: input.incidentDateTime ?? null,
    lastKnownPlace: input.lastKnownPlace ?? null,
    incidentDescription: input.incidentDescription,
    deviceDescriptionSnapshot: facts.deviceDescriptionSnapshot,
    draftText: generated.draftText,
    isSimulated: generated.isSimulated,
  });

  await repos.timelineEvents.create({
    caseId,
    type: 'POLICE_COMPLAINT_CREATED',
    title: 'Police complaint drafted',
    source: 'AI_AGENT',
    verificationStatus: generated.isSimulated ? 'UNVERIFIED' : 'AI_GENERATED',
    policeReportId: report.id,
    createdByUserId: userId,
  });

  return loadState(repos, userId, report.id);
}

export async function regeneratePoliceReportDraft(
  pool: Pool,
  userId: UserId,
  caseId: RecoveryCaseId,
  reportId: PoliceReportId,
  input: RegeneratePoliceReportDraftInput,
): Promise<PoliceReportState> {
  const repos = createRepositories(pool);
  const existing = await repos.policeReports.findByIdForUser(reportId, userId);
  if (!existing || existing.caseId !== caseId) throw new NotFoundError('Police report not found');

  const facts = await gatherFacts(repos, userId, caseId, input);
  const generated = await generatePoliceComplaintDraft(facts);

  const updated = await repos.policeReports.regenerate(reportId, userId, {
    ownerFullName: input.ownerFullName,
    ownerContact: input.ownerContact,
    incidentDateTime: input.incidentDateTime ?? null,
    lastKnownPlace: input.lastKnownPlace ?? null,
    incidentDescription: input.incidentDescription,
    deviceDescriptionSnapshot: facts.deviceDescriptionSnapshot,
    draftText: generated.draftText,
    isSimulated: generated.isSimulated,
  });
  if (!updated) throw new NotFoundError('Police report not found');

  return loadState(repos, userId, reportId);
}

export async function updatePoliceReportDraftManually(
  pool: Pool,
  userId: UserId,
  caseId: RecoveryCaseId,
  reportId: PoliceReportId,
  input: UpdatePoliceReportDraftInput,
): Promise<PoliceReportState> {
  const repos = createRepositories(pool);
  const existing = await repos.policeReports.findByIdForUser(reportId, userId);
  if (!existing || existing.caseId !== caseId) throw new NotFoundError('Police report not found');

  const updated = await repos.policeReports.updateDraft(reportId, userId, input.draftText, false);
  if (!updated) throw new NotFoundError('Police report not found');

  return loadState(repos, userId, reportId);
}

function buildPoliceReportEvidenceStorageKey(reportId: PoliceReportId, versionNumber: number): string {
  return `internal:police-report-version:${reportId}:${versionNumber}`;
}

/**
 * "Add the approved complaint to the Evidence Vault and Timeline" (master
 * spec, verbatim). No real object-storage backend exists yet (Part 15 owns
 * that) - the complaint's authoritative text already lives durably in
 * police_reports/police_report_versions, so storageKey is a clearly-marked
 * internal reference (`internal:police-report-version:...`) rather than a
 * fabricated file path; Part 15's future signed-URL logic will need to
 * special-case this prefix to serve the text back out. Each approval -
 * including a re-approval after an edit - creates its own Evidence row, so
 * the Vault ends up with a real version history of what was actually
 * approved over time, matching Evidence's immutable-per-row, upload-like
 * model rather than trying to mutate one row in place.
 */
export async function approvePoliceReport(
  pool: Pool,
  userId: UserId,
  caseId: RecoveryCaseId,
  reportId: PoliceReportId,
): Promise<PoliceReportState> {
  const repos = createRepositories(pool);
  const existing = await repos.policeReports.findByIdForUser(reportId, userId);
  if (!existing || existing.caseId !== caseId) throw new NotFoundError('Police report not found');

  const approved = await repos.policeReports.approve(reportId, userId);
  if (!approved) throw new NotFoundError('Police report not found');

  const versions = await repos.policeReports.listVersions(reportId);
  const latestVersion = versions[0];
  if (!latestVersion) throw new Error('Approved police report has no versions');

  const evidence = await repos.evidence.create({
    caseId,
    uploadedByUserId: userId,
    category: 'POLICE_COMPLAINT',
    description: `Approved police complaint draft (v${latestVersion.versionNumber})`,
    storageKey: buildPoliceReportEvidenceStorageKey(reportId, latestVersion.versionNumber),
    originalFileName: `police-complaint-v${latestVersion.versionNumber}.txt`,
    mimeType: 'text/plain',
    fileSizeBytes: Buffer.byteLength(approved.draftText, 'utf8'),
    malwareScanStatus: 'SKIPPED',
  });

  await repos.timelineEvents.create({
    caseId,
    type: 'POLICE_COMPLAINT_APPROVED',
    title: 'Police complaint approved',
    source: 'USER',
    verificationStatus: 'USER_REPORTED',
    policeReportId: reportId,
    evidenceId: evidence.id,
    createdByUserId: userId,
  });

  return loadState(repos, userId, reportId);
}

/**
 * The case's POLICE_REPORT recovery action only ever completes here - once
 * the user attests they actually filed it - never on mere approval of the
 * text. Recalculating afterward is what lets a CEIR_SUBMISSION action that
 * depends on POLICE_REPORT unblock (Part 6).
 */
export async function markPoliceReportSubmitted(
  pool: Pool,
  userId: UserId,
  caseId: RecoveryCaseId,
  reportId: PoliceReportId,
  input: MarkPoliceReportSubmittedInput,
): Promise<PoliceReportState> {
  const repos = createRepositories(pool);
  const existing = await repos.policeReports.findByIdForUser(reportId, userId);
  if (!existing || existing.caseId !== caseId) throw new NotFoundError('Police report not found');

  const submitted = await repos.policeReports.markUserSubmitted(reportId, userId, input.externalReferenceNumber);
  if (!submitted) throw new NotFoundError('Police report not found');

  const actions = await repos.recoveryActions.listByCase(caseId);
  const policeAction = actions.find((a) => a.type === 'POLICE_REPORT');
  if (policeAction && policeAction.status !== 'COMPLETED') {
    await repos.recoveryActions.updateStatus(policeAction.id, userId, 'COMPLETED');
  }

  await recalculateRecoveryCase(pool, userId, caseId);

  return loadState(repos, userId, reportId);
}
