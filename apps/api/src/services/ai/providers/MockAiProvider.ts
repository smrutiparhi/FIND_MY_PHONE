import type { AiCompletionRequest, AiCompletionResult, AiProvider } from '../AiProvider';

/**
 * Deterministic, keyless stand-in used whenever AI_PROVIDER=mock (the
 * default) or no AI_API_KEY is configured. Every response is explicitly
 * flagged `isSimulated: true` and says so in its own text, so it can never be
 * mistaken for a real model output by callers or the UI - see master spec:
 * "Do not create ... simulated APIs presented as real integrations ...
 * without clearly marking them as development/demo functionality."
 */
export class MockAiProvider implements AiProvider {
  readonly name = 'mock';

  async generateCompletion(request: AiCompletionRequest): Promise<AiCompletionResult> {
    const lastMessage = request.messages.at(-1)?.content ?? '';
    return {
      content: `[DEMO AI PROVIDER - no real model is configured] Received: "${lastMessage.slice(0, 200)}"`,
      provider: this.name,
      model: 'mock-echo-1',
      isSimulated: true,
    };
  }
}
