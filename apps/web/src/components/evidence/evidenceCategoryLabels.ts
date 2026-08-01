import type { EvidenceCategory } from '@recoverai/shared';

export const EVIDENCE_CATEGORY_LABELS: Record<EvidenceCategory, string> = {
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
