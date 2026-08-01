import type { ReactElement } from 'react';
import type { EvidenceCategory, MalwareScanStatus } from '@recoverai/shared';

const EVIDENCE_CATEGORY_LABELS: Record<EvidenceCategory, string> = {
  PURCHASE_INVOICE: 'Purchase invoice',
  DEVICE_PHOTO: 'Device photo',
  IMEI_SERIAL_DOCUMENT: 'IMEI/serial documentation',
  LOCATION_SCREENSHOT: 'Location screenshot',
  POLICE_COMPLAINT: 'Police complaint',
  POLICE_ACKNOWLEDGEMENT: 'Police acknowledgement',
  CEIR_ACKNOWLEDGEMENT: 'CEIR acknowledgement',
  CARRIER_SIM_DOCUMENT: 'Carrier/SIM documentation',
  OTHER: 'Other',
};

export function evidenceCategoryLabel(category: EvidenceCategory): string {
  return EVIDENCE_CATEGORY_LABELS[category];
}

export function EvidenceCategoryBadge({ category }: { category: EvidenceCategory }): ReactElement {
  return (
    <span className="inline-flex items-center rounded-full border border-white/15 bg-white/5 px-2.5 py-0.5 text-xs font-medium text-slate-300 backdrop-blur-sm">
      {EVIDENCE_CATEGORY_LABELS[category]}
    </span>
  );
}

const SCAN_STYLES: Record<MalwareScanStatus, string> = {
  PENDING: 'border-amber-400/40 bg-amber-400/10 text-amber-300',
  CLEAN: 'border-emerald-400/40 bg-emerald-400/10 text-emerald-300',
  FLAGGED: 'border-rose-500/50 bg-rose-500/15 text-rose-300',
  SKIPPED: 'border-white/15 bg-white/5 text-slate-400',
};

const SCAN_LABELS: Record<MalwareScanStatus, string> = {
  PENDING: 'Scan pending',
  CLEAN: 'Scanned - clean',
  FLAGGED: 'Flagged - do not open',
  SKIPPED: 'Scan skipped',
};

export function MalwareScanBadge({ status }: { status: MalwareScanStatus }): ReactElement {
  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium backdrop-blur-sm ${SCAN_STYLES[status]}`}>
      {SCAN_LABELS[status]}
    </span>
  );
}
