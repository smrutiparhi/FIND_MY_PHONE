import { logger } from '../../lib/logger';
import { getAiProvider } from '../ai';
import type { AiContentBlock } from '../ai/AiProvider';
import { buildPoliceComplaintFactsMessage, buildPoliceComplaintSystemPrompt } from './policeComplaintSystemPrompt';
import { checkPoliceComplaintDraft, buildReviewRequiredNotice } from './policeComplaintOutputGuard';
import type { PoliceComplaintFacts } from './policeComplaintFacts';

export interface GeneratedPoliceComplaintDraft {
  draftText: string;
  isSimulated: boolean;
  provider: string;
  flagged: boolean;
}

/**
 * One completion call, no tools - the model only ever turns
 * PoliceComplaintFacts into prose, it has no way to look anything up or
 * take an action. When the output guard trips, the draft is kept (never
 * silently discarded - the user's already-typed facts shouldn't be lost)
 * but prefixed with a plain-text review notice, since "the user must
 * approve the final text" already requires a human look at it either way.
 */
export async function generatePoliceComplaintDraft(facts: PoliceComplaintFacts): Promise<GeneratedPoliceComplaintDraft> {
  const provider = getAiProvider();
  const completion = await provider.generateCompletion({
    systemPrompt: buildPoliceComplaintSystemPrompt(),
    messages: [{ role: 'user', content: buildPoliceComplaintFactsMessage(facts) }],
    maxOutputTokens: 1200,
  });

  const rawText = completion.content
    .filter((block): block is Extract<AiContentBlock, { type: 'text' }> => block.type === 'text')
    .map((block) => block.text)
    .join('\n')
    .trim();

  const guard = checkPoliceComplaintDraft(rawText, facts);
  if (!guard.safe) {
    logger.warn({ reasons: guard.reasons }, 'Police complaint draft flagged by outputGuard');
  }

  return {
    draftText: guard.safe ? rawText : `${buildReviewRequiredNotice(guard.reasons)}${rawText}`,
    isSimulated: completion.isSimulated,
    provider: completion.provider,
    flagged: !guard.safe,
  };
}
