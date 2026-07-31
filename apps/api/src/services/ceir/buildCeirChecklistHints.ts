import type { CeirChecklistHint, Device, Evidence, PoliceReport, SimProtectionRecord } from '@recoverai/shared';

const LABELS: Record<CeirChecklistHint['item'], string> = {
  IMEI_INFORMATION: 'IMEI information',
  MOBILE_NUMBER: 'Mobile number',
  DEVICE_DETAILS: 'Device details',
  POLICE_REPORT: 'Police report',
  IDENTITY_DOCUMENT: 'Identity document',
  PURCHASE_INVOICE: 'Purchase invoice (if available)',
  REPLACEMENT_SIM_STATUS: 'Replacement SIM / status (where applicable)',
  OTHER: 'Other required information',
};

/**
 * Purely informational readiness hints, computed fresh from real data
 * already on file elsewhere in the case - never persisted, never used to
 * auto-check the user's own checklist (services/ceir/... only reads
 * ceir_records.checklist_completed_items, which stays 100% user-driven).
 * Two items (IDENTITY_DOCUMENT, OTHER) have no equivalent anywhere in this
 * app and are always reported unsatisfied - that's accurate, not a bug.
 */
export function buildCeirChecklistHints(input: {
  device: Device;
  policeReports: PoliceReport[];
  simRecord: SimProtectionRecord;
  evidence: Evidence[];
}): CeirChecklistHint[] {
  const hasImei = Boolean(input.device.imei1Encrypted || input.device.imei2Encrypted);
  const hasPurchaseInvoice = input.evidence.some((e) => e.category === 'PURCHASE_INVOICE');
  const policeReportFiled = input.policeReports.some((r) => r.status === 'USER_MARKED_SUBMITTED');
  const simResolved = input.simRecord.status === 'REPLACED' || input.simRecord.status === 'BLOCKED';

  const hints: Array<Omit<CeirChecklistHint, 'label'>> = [
    {
      item: 'IMEI_INFORMATION',
      satisfied: hasImei,
      detail: hasImei ? 'IMEI is on file for this device.' : 'No IMEI is on file for this device yet.',
    },
    {
      item: 'MOBILE_NUMBER',
      satisfied: Boolean(input.device.phoneNumberMasked),
      detail: input.device.phoneNumberMasked
        ? `On file: ${input.device.phoneNumberMasked}`
        : 'No phone number is on file for this device.',
    },
    {
      item: 'DEVICE_DETAILS',
      satisfied: true,
      detail: `${input.device.manufacturer} ${input.device.model} is already on file.`,
    },
    {
      item: 'POLICE_REPORT',
      satisfied: policeReportFiled,
      detail: policeReportFiled
        ? 'A police complaint has been recorded as filed.'
        : 'No police complaint has been recorded as filed yet - use the Police Complaint Assistant.',
    },
    {
      item: 'IDENTITY_DOCUMENT',
      satisfied: false,
      detail: 'Not tracked by RecoverAI - have a government-issued ID (e.g. Aadhaar, passport) ready.',
    },
    {
      item: 'PURCHASE_INVOICE',
      satisfied: hasPurchaseInvoice,
      detail: hasPurchaseInvoice ? 'A purchase invoice is in the Evidence Vault.' : "Optional - CEIR doesn't require it if you don't have one.",
    },
    {
      item: 'REPLACEMENT_SIM_STATUS',
      satisfied: simResolved,
      detail: `SIM status: ${input.simRecord.status.replaceAll('_', ' ').toLowerCase()}.`,
    },
    {
      item: 'OTHER',
      satisfied: false,
      detail: 'Anything else the CEIR form asks for that is specific to your situation.',
    },
  ];

  return hints.map((hint) => ({ ...hint, label: LABELS[hint.item] }));
}
