import type { Evidence, EvidenceAccessResult, PoliceReportId } from '@recoverai/shared';
import type { Repositories } from '../../db/repositories';
import { createEvidenceAccessUrl } from './evidenceStorage';

const POLICE_REPORT_VERSION_PREFIX = 'internal:police-report-version:';
const CEIR_RECORD_PREFIX = 'internal:ceir-record:';

/**
 * Parts 13 and 14 create Evidence rows for the approved police complaint
 * text and the CEIR submission record before any real object-storage
 * backend existed (see their own docs for why) - their `storageKey` is a
 * clearly-marked internal reference, never a real object-storage path.
 * Rather than treat that as a Part 15 problem to "fix" retroactively, this
 * is exactly the special case those parts' own comments anticipated:
 * resolve the marker back to the real text it points at instead of asking
 * object storage for something that was never written there.
 */
export async function resolveEvidenceAccess(repos: Repositories, evidence: Evidence): Promise<EvidenceAccessResult> {
  if (evidence.storageKey.startsWith(POLICE_REPORT_VERSION_PREFIX)) {
    const [, , reportId, versionNumberRaw] = evidence.storageKey.split(':');
    const versions = await repos.policeReports.listVersions(reportId as PoliceReportId);
    const version = versions.find((v) => v.versionNumber === Number(versionNumberRaw));
    return { kind: 'inline_text', text: version?.draftText ?? '(this police complaint version is no longer available)' };
  }

  if (evidence.storageKey.startsWith(CEIR_RECORD_PREFIX)) {
    const record = await repos.ceirRecords.findByCase(evidence.caseId);
    const text = record
      ? [
          `CEIR request status: ${record.status}`,
          `Request ID: ${record.ceirRequestId ?? 'not recorded'}`,
          `Submission date: ${record.submissionDate ?? 'not recorded'}`,
          `Notes: ${record.notes ?? '(none)'}`,
        ].join('\n')
      : '(this CEIR record is no longer available)';
    return { kind: 'inline_text', text };
  }

  const { url, expiresAt } = await createEvidenceAccessUrl(evidence.storageKey);
  return { kind: 'signed_url', url, expiresAt };
}
