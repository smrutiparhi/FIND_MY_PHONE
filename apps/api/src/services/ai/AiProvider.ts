export interface AiChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface AiCompletionRequest {
  systemPrompt: string;
  messages: AiChatMessage[];
  maxOutputTokens?: number;
}

export interface AiCompletionResult {
  content: string;
  provider: string;
  model: string;
  /** True whenever the response did not come from a real model (see MockAiProvider). */
  isSimulated: boolean;
}

/**
 * Every AI-driven feature (Part 7 - AI Recovery Agent, complaint drafting,
 * recovery explanations) talks to this interface, never to a vendor SDK
 * directly, so swapping or mocking providers never touches calling code.
 *
 * Deterministic recovery-sequencing (Part 6 - Recovery Decision Engine) never
 * depends on this interface: per the master spec, the AI layer may explain a
 * recommendation but must never override mandatory security rules.
 */
export interface AiProvider {
  readonly name: string;
  generateCompletion(request: AiCompletionRequest): Promise<AiCompletionResult>;
}
