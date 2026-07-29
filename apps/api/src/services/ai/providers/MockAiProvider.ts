import type { AiCompletionRequest, AiCompletionResult, AiProvider } from '../AiProvider';

/**
 * Deterministic, keyless stand-in used whenever AI_PROVIDER=mock (the
 * default) or no AI_API_KEY is configured. Every response is explicitly
 * flagged `isSimulated: true` and says so in its own text, so it can never be
 * mistaken for a real model output by callers or the UI - see master spec:
 * "Do not create ... simulated APIs presented as real integrations ...
 * without clearly marking them as development/demo functionality."
 *
 * Never calls a tool itself (stopReason is always 'end_turn') - it has no
 * real reasoning to decide when a write is safe, so it only ever echoes.
 */
export class MockAiProvider implements AiProvider {
  readonly name = 'mock';

  async generateCompletion(request: AiCompletionRequest): Promise<AiCompletionResult> {
    const lastMessage = request.messages.at(-1)?.content ?? '';
    const lastText = typeof lastMessage === 'string' ? lastMessage : lastMessage.find((b) => b.type === 'text')?.text;
    return {
      content: [
        {
          type: 'text',
          text: `[DEMO AI PROVIDER - no real model is configured] Received: "${(lastText ?? '').slice(0, 200)}"`,
        },
      ],
      stopReason: 'end_turn',
      provider: this.name,
      model: 'mock-echo-1',
      isSimulated: true,
    };
  }
}
