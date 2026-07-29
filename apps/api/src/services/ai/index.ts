import { env } from '../../config/env';
import { logger } from '../../lib/logger';
import { MockAiProvider } from './providers/MockAiProvider';
import { AnthropicAiProvider } from './providers/AnthropicAiProvider';
import { OpenAiAiProvider } from './providers/OpenAiAiProvider';
import type { AiProvider } from './AiProvider';

const DEFAULT_MODELS: Record<'anthropic' | 'openai', string> = {
  anthropic: 'claude-sonnet-5',
  openai: 'gpt-4o-mini',
};

let cachedProvider: AiProvider | undefined;

/**
 * Provider factory. Falls back to MockAiProvider whenever AI_PROVIDER is
 * 'mock' (the default) or a real provider was requested without the API key
 * it needs - the app should always boot and the chat should always respond
 * with *something* clearly marked simulated, never a 500 just because a demo
 * environment has no key configured.
 */
export function getAiProvider(): AiProvider {
  if (cachedProvider) return cachedProvider;

  if (env.AI_PROVIDER !== 'mock' && !env.AI_API_KEY) {
    logger.warn(
      { requestedProvider: env.AI_PROVIDER },
      'AI_PROVIDER is set but AI_API_KEY is missing - falling back to MockAiProvider',
    );
  } else if (env.AI_PROVIDER === 'anthropic' && env.AI_API_KEY) {
    cachedProvider = new AnthropicAiProvider(env.AI_API_KEY, env.AI_MODEL ?? DEFAULT_MODELS.anthropic);
  } else if (env.AI_PROVIDER === 'openai' && env.AI_API_KEY) {
    cachedProvider = new OpenAiAiProvider(env.AI_API_KEY, env.AI_MODEL ?? DEFAULT_MODELS.openai);
  }

  if (!cachedProvider) cachedProvider = new MockAiProvider();
  return cachedProvider;
}

export type {
  AiProvider,
  AiCompletionRequest,
  AiCompletionResult,
  AiChatMessage,
  AiContentBlock,
  AiTextBlock,
  AiToolUseBlock,
  AiToolResultBlock,
  AiToolDefinition,
  AiToolParameterSchema,
} from './AiProvider';
