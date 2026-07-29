import type { Pool } from 'pg';
import type { AiAgentChatMessage, AiAgentToolCallSummary, RecoveryCase, RecoveryCaseId, RecoveryPlan, UserId } from '@recoverai/shared';
import { createRepositories } from '../../db/repositories';
import { NotFoundError } from '../../lib/errors';
import { logger } from '../../lib/logger';
import { getAiProvider } from '../ai';
import type { AiChatMessage, AiContentBlock } from '../ai/AiProvider';
import { recalculateRecoveryCase } from '../recoveryEngine/recalculateRecoveryCase';
import { toRecoveryPlan } from '../recoveryEngine/toRecoveryPlan';
import { buildCaseContextBlock } from './caseContext';
import { checkAgentReply, SAFE_FALLBACK_REPLY } from './outputGuard';
import { buildSystemPrompt } from './systemPrompt';
import { RECOVERY_AGENT_TOOLS } from './tools';
import { TOOL_HANDLERS, type ToolHandlerContext } from './toolHandlers';

const MAX_TOOL_ITERATIONS = 4;

async function loadCaseSnapshot(pool: Pool, userId: UserId, caseId: RecoveryCaseId) {
  const { recoveryCase, engineResult, actionIdByType } = await recalculateRecoveryCase(pool, userId, caseId);
  const repos = createRepositories(pool);
  const device = await repos.devices.findById(recoveryCase.deviceId, userId);
  if (!device) throw new NotFoundError('Device not found');
  const [latestLocation, policeReports, ceirRecord] = await Promise.all([
    repos.locationObservations.findLatestByCase(caseId),
    repos.policeReports.listByCase(caseId),
    repos.ceirRecords.findByCase(caseId),
  ]);
  const recoveryPlan = toRecoveryPlan(engineResult, actionIdByType);
  const contextBlock = buildCaseContextBlock(recoveryCase, device, recoveryPlan, latestLocation, policeReports[0] ?? null, ceirRecord);
  return { recoveryCase, recoveryPlan, contextBlock, locationAvailable: latestLocation !== null };
}

function toProviderMessages(messages: AiAgentChatMessage[]): AiChatMessage[] {
  return messages.map((m) => ({ role: m.role, content: m.content }));
}

export interface RunAgentTurnResult {
  reply: string;
  provider: string;
  isSimulated: boolean;
  toolCalls: AiAgentToolCallSummary[];
  recoveryCase: RecoveryCase;
  recoveryPlan: RecoveryPlan;
}

/**
 * One full Recovery Agent turn: fetch fresh case context, call the model
 * with tools available, execute any tool calls it makes (re-fetching
 * context after a write so a follow-up tool call or the final reply sees
 * current state), and return a plain-text reply plus a summary of anything
 * that changed. Caps tool-use rounds at MAX_TOOL_ITERATIONS so a
 * misbehaving model can't loop forever within one HTTP request.
 */
export async function runAgentTurn(
  pool: Pool,
  userId: UserId,
  caseId: RecoveryCaseId,
  clientMessages: AiAgentChatMessage[],
): Promise<RunAgentTurnResult> {
  const lastUserMessage = [...clientMessages].reverse().find((m) => m.role === 'user');
  const provider = getAiProvider();

  let snapshot = await loadCaseSnapshot(pool, userId, caseId);
  const toolCallSummaries: AiAgentToolCallSummary[] = [];
  const transcript: AiChatMessage[] = toProviderMessages(clientMessages);

  for (let iteration = 0; iteration < MAX_TOOL_ITERATIONS; iteration++) {
    const completion = await provider.generateCompletion({
      systemPrompt: buildSystemPrompt(snapshot.contextBlock),
      messages: transcript,
      tools: RECOVERY_AGENT_TOOLS,
      maxOutputTokens: 1024,
    });

    const toolUseBlocks = completion.content.filter((b): b is Extract<AiContentBlock, { type: 'tool_use' }> => b.type === 'tool_use');
    const textBlocks = completion.content.filter((b): b is Extract<AiContentBlock, { type: 'text' }> => b.type === 'text');

    if (completion.stopReason !== 'tool_use' || toolUseBlocks.length === 0) {
      const rawReply = textBlocks.map((b) => b.text).join('\n').trim();
      const guard = checkAgentReply(rawReply, snapshot.locationAvailable);
      if (!guard.safe) {
        logger.warn({ caseId, reason: guard.reason }, 'Recovery Agent reply blocked by outputGuard');
      }
      return {
        reply: guard.safe ? rawReply || "I'm here - what would you like to do next?" : SAFE_FALLBACK_REPLY,
        provider: completion.provider,
        isSimulated: completion.isSimulated,
        toolCalls: toolCallSummaries,
        recoveryCase: snapshot.recoveryCase,
        recoveryPlan: snapshot.recoveryPlan,
      };
    }

    transcript.push({ role: 'assistant', content: completion.content });

    const ctx: ToolHandlerContext = { pool, userId, caseId, lastUserMessageText: lastUserMessage?.content ?? '' };
    let anyChanged = false;
    const resultBlocks: AiContentBlock[] = [];
    for (const toolUse of toolUseBlocks) {
      const handler = TOOL_HANDLERS[toolUse.name];
      const outcome = handler
        ? await handler(ctx, toolUse.input)
        : { resultText: `Unknown tool: ${toolUse.name}`, isError: true, changed: false };
      if (outcome.changed) anyChanged = true;
      if (outcome.summary) toolCallSummaries.push({ tool: toolUse.name, summary: outcome.summary });
      resultBlocks.push({ type: 'tool_result', toolUseId: toolUse.id, content: outcome.resultText, isError: outcome.isError });
    }
    transcript.push({ role: 'user', content: resultBlocks });

    if (anyChanged) {
      snapshot = await loadCaseSnapshot(pool, userId, caseId);
    }
  }

  logger.warn({ caseId }, 'Recovery Agent hit MAX_TOOL_ITERATIONS without a final text reply');
  return {
    reply: "I've made the changes you confirmed, but I'm not able to summarize further right now - refresh to see the latest plan.",
    provider: provider.name,
    isSimulated: provider.name === 'mock',
    toolCalls: toolCallSummaries,
    recoveryCase: snapshot.recoveryCase,
    recoveryPlan: snapshot.recoveryPlan,
  };
}
