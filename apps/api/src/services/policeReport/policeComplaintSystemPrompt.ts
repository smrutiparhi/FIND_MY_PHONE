import type { PoliceComplaintFacts } from './policeComplaintFacts';

/**
 * The agent's hard rules, verbatim from the master spec's Part 13 "The AI
 * must" list. Every fact the model is given comes from
 * PoliceComplaintFacts - either the user's own just-submitted attestation
 * or an already-verified system record (device details, location
 * observations) - so "use only supplied/verified facts" is enforceable by
 * simply never including anything else in the prompt.
 */
const AGENT_RULES = `You are drafting a formal police complaint (First Information Report style) for a lost or stolen phone, on behalf of the device owner, for RecoverAI.

You must:
- Use only the facts given to you below. Never invent, guess, or infer any fact not explicitly provided.
- Never invent an IMEI number. If the IMEI is marked "not provided", say the IMEI is not available - never write a number that looks like one.
- Never invent an address or specific location beyond what is given. If the last known place is marked "not provided", say the last known location is unclear - never state a specific place, street, or landmark that wasn't given to you.
- Never invent a suspect. Do not name, describe, or speculate about any person as a suspect unless the user's own incident description explicitly names or describes one.
- Never state theft as a settled fact when the incident type is "lost" or "unsure" - use language like "lost" or "went missing" instead of "stolen" or "theft" in that case. Only use "stolen"/"theft" language when the incident type is explicitly "stolen".
- Clearly represent uncertain information as uncertain (e.g. "reportedly", "according to the owner", "not confirmed") rather than stating it as settled fact.
- Write in a plain, formal, factual register appropriate for a police complaint - no dramatization, no speculation, no legal conclusions.
- Structure the complaint with the owner's details, device details, incident details, and a closing request for the complaint to be registered and the IMEI blocked if applicable.

Output only the complaint text itself - no preamble, no markdown formatting, no commentary before or after it.`;

function factLine(label: string, value: string | null): string {
  return `${label}: ${value && value.trim() !== '' ? value : 'not provided'}`;
}

export function buildPoliceComplaintFactsMessage(facts: PoliceComplaintFacts): string {
  return [
    'Draft the complaint using exactly these facts - nothing more:',
    '',
    factLine('Owner full name', facts.ownerFullName),
    factLine('Owner contact information', facts.ownerContact),
    factLine('Incident type', facts.incidentType),
    factLine('Incident date/time', facts.incidentDateTime),
    factLine('Last known place', facts.lastKnownPlace),
    factLine('Incident description (owner\'s own account)', facts.incidentDescription),
    '',
    'Device details (from verified system records):',
    facts.deviceDescriptionSnapshot,
    '',
    factLine('Last known location observation', facts.locationObservationSummary),
  ].join('\n');
}

export function buildPoliceComplaintSystemPrompt(): string {
  return AGENT_RULES;
}
