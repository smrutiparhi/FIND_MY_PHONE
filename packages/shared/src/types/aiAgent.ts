import type { RecoveryCase } from './domain';
import type { RecoveryPlan } from './recoveryEngine';

/**
 * The client is the source of truth for conversation history (see
 * docs/AI_RECOVERY_AGENT.md - "why chat isn't persisted server-side"): every
 * turn resends the full transcript so the backend never needs to store raw
 * chat content, only the state changes it produces.
 */
export interface AiAgentChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export const AI_AGENT_CHAT_MESSAGE_LIMITS = {
  maxMessages: 40,
  maxMessageLength: 4000,
} as const;

/** A write the agent made during a turn, surfaced so the UI can show a "Verified system state" notice distinct from the AI's own prose. */
export interface AiAgentToolCallSummary {
  tool: string;
  summary: string;
}

export interface SendAgentMessageInput {
  messages: AiAgentChatMessage[];
}

export interface SendAgentMessageResult {
  reply: string;
  provider: string;
  isSimulated: boolean;
  toolCalls: AiAgentToolCallSummary[];
  recoveryCase: RecoveryCase;
  recoveryPlan: RecoveryPlan;
}
