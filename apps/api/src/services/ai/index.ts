import { env } from '../../config/env';
import { logger } from '../../lib/logger';
import { MockAiProvider } from './providers/MockAiProvider';
import type { AiProvider } from './AiProvider';

let cachedProvider: AiProvider | undefined;

/**
 * Provider factory. Real providers (Anthropic, OpenAI) are implemented in
 * Part 7 - AI Recovery Agent, once there are concrete prompts and tool
 * definitions to send them; requesting one before then falls back to the
 * mock rather than failing the whole API.
 */
export function getAiProvider(): AiProvider {
  if (!cachedProvider) {
    if (env.AI_PROVIDER !== 'mock') {
      logger.warn(
        { requestedProvider: env.AI_PROVIDER },
        'Requested AI_PROVIDER has no real implementation yet (arrives in Part 7) - falling back to MockAiProvider',
      );
    }
    cachedProvider = new MockAiProvider();
  }
  return cachedProvider;
}

export type {
  AiProvider,
  AiCompletionRequest,
  AiCompletionResult,
  AiChatMessage,
} from './AiProvider';
