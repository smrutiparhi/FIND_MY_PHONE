import type { Device, RecoveryCase, TimelineEvent } from '@recoverai/shared';

function formatTimestamp(iso: string): string {
  return new Date(iso).toISOString().replace('T', ' ').replace(/\.\d+Z$/, ' UTC');
}

/**
 * "Export a sanitized case summary that excludes secrets and unnecessary
 * sensitive data" (master spec, verbatim). The sanitization here isn't a
 * redaction pass over otherwise-sensitive fields - it works because every
 * field this function actually reads was already designed, in earlier
 * parts, to be safe on its own: TimelineEvent.title/description never embed
 * a raw IMEI, exact coordinates, or file contents (those live only in the
 * linked device/location/evidence rows, reached through a separate,
 * explicit, ownership-scoped call - see docs/TIMELINE.md). This function
 * deliberately never makes those calls, and never touches
 * imei1Encrypted/imei2Encrypted/serialNumberEncrypted even in their
 * encrypted form - so there is no secret-bearing field available to leak by
 * omitting it.
 */
export function buildSanitizedCaseSummary(input: {
  recoveryCase: RecoveryCase;
  device: Device;
  events: TimelineEvent[];
}): string {
  const { recoveryCase, device, events } = input;
  const lines: string[] = [];

  lines.push('RecoverAI - Case Summary');
  lines.push('(Sanitized export - excludes IMEI/serial, exact location, and file contents.)');
  lines.push('');
  lines.push(`Case ID: ${recoveryCase.id}`);
  lines.push(`Incident type: ${recoveryCase.incidentType}`);
  lines.push(`Status: ${recoveryCase.status}`);
  lines.push(`Risk level: ${recoveryCase.riskLevel ?? 'not yet assessed'}`);
  lines.push(`Reported: ${formatTimestamp(recoveryCase.createdAt)}`);
  if (recoveryCase.closedAt) lines.push(`Closed: ${formatTimestamp(recoveryCase.closedAt)}`);
  if (recoveryCase.lastSeenDescription) lines.push(`Last seen: ${recoveryCase.lastSeenDescription}`);
  lines.push('');
  lines.push('Device');
  lines.push(`  ${device.nickname} - ${device.manufacturer} ${device.model} (${device.platform})`);
  if (device.carrier) lines.push(`  Carrier: ${device.carrier}`);
  lines.push('');
  lines.push(`Timeline (${events.length} event${events.length === 1 ? '' : 's'}, chronological)`);
  lines.push('');

  const chronological = [...events].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
  for (const event of chronological) {
    lines.push(`[${formatTimestamp(event.createdAt)}] ${event.title}`);
    lines.push(`  Type: ${event.type} | Source: ${event.source} | Verification: ${event.verificationStatus}`);
    if (event.description) lines.push(`  ${event.description}`);
    lines.push('');
  }

  return lines.join('\n');
}
