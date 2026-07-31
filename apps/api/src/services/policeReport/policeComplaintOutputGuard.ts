import type { PoliceComplaintFacts } from './policeComplaintFacts';

/**
 * A mechanical backstop against the master spec's "The AI must never..."
 * list, applied to the generated draft text - the system prompt
 * (policeComplaintSystemPrompt.ts) is the primary control, this catches the
 * most literal violations of it. Not a substitute for human review: the
 * master spec already requires "the user must approve the final text"
 * regardless of what this catches or misses.
 */
const LONG_DIGIT_RUN = /\d[\d -]{12,}\d/;
const THEFT_LANGUAGE = /\b(stolen|theft|thief|thieves|robbed|robbery)\b/i;
const ADDRESS_LIKE = /\b\d+[a-z]?\s+(?:[a-z]+\s+){0,3}(street|st\.|road|rd\.|avenue|ave\.|lane|ln\.|block|sector|colony|nagar)\b/i;
const SUSPECT_LANGUAGE = /\b(the suspect(?:'s name)? is|suspect named|perpetrator named|the culprit is)\b/i;

export interface PoliceComplaintGuardResult {
  safe: boolean;
  reasons: string[];
}

export function checkPoliceComplaintDraft(draftText: string, facts: PoliceComplaintFacts): PoliceComplaintGuardResult {
  const reasons: string[] = [];

  const hasRealImei = Boolean(facts.imei1 || facts.imei2);
  if (!hasRealImei && LONG_DIGIT_RUN.test(draftText)) {
    reasons.push('no IMEI was supplied, but the draft contains a long digit sequence that looks like one');
  }

  if (facts.incidentType !== 'STOLEN' && THEFT_LANGUAGE.test(draftText)) {
    reasons.push('incident type is not "stolen", but the draft uses theft/stolen language');
  }

  if (!facts.lastKnownPlace && ADDRESS_LIKE.test(draftText)) {
    reasons.push('no last known place was supplied, but the draft appears to state a specific address');
  }

  if (SUSPECT_LANGUAGE.test(draftText)) {
    reasons.push('the draft appears to name or assert a specific suspect');
  }

  return { safe: reasons.length === 0, reasons };
}

export function buildReviewRequiredNotice(reasons: string[]): string {
  return `REVIEW REQUIRED before approving - this draft may include unverified details (${reasons.join('; ')}). Edit it to fix anything that isn't accurate before approving.\n\n`;
}
