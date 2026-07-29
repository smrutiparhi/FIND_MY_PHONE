import type {
  AiChatMessage,
  AiCompletionRequest,
  AiCompletionResult,
  AiContentBlock,
  AiProvider,
  AiStopReason,
  AiToolDefinition,
} from '../AiProvider';

const API_URL = 'https://api.anthropic.com/v1/messages';
const ANTHROPIC_VERSION = '2023-06-01';

function toAnthropicContent(content: AiChatMessage['content']): unknown {
  if (typeof content === 'string') return content;
  return content.map((block) => {
    if (block.type === 'text') return { type: 'text', text: block.text };
    if (block.type === 'tool_use') return { type: 'tool_use', id: block.id, name: block.name, input: block.input };
    return { type: 'tool_result', tool_use_id: block.toolUseId, content: block.content, is_error: block.isError };
  });
}

function toAnthropicTools(tools: AiToolDefinition[]): unknown[] {
  return tools.map((tool) => ({ name: tool.name, description: tool.description, input_schema: tool.parameters }));
}

function fromAnthropicStopReason(reason: string | null): AiStopReason {
  if (reason === 'tool_use') return 'tool_use';
  if (reason === 'max_tokens') return 'max_tokens';
  return 'end_turn';
}

interface AnthropicResponseBlock {
  type: 'text' | 'tool_use';
  text?: string;
  id?: string;
  name?: string;
  input?: Record<string, unknown>;
}

interface AnthropicResponse {
  content: AnthropicResponseBlock[];
  model: string;
  stop_reason: string | null;
}

/**
 * Talks to the Anthropic Messages API directly over `fetch` rather than
 * pulling in the full SDK - the request/response shape needed here (system
 * prompt, a message list, optional tools, one completion) is small enough
 * that a hand-rolled adapter keeps AiProvider the single translation point
 * instead of leaking SDK types into it.
 */
export class AnthropicAiProvider implements AiProvider {
  readonly name = 'anthropic';

  constructor(
    private readonly apiKey: string,
    private readonly model: string,
  ) {}

  async generateCompletion(request: AiCompletionRequest): Promise<AiCompletionResult> {
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'x-api-key': this.apiKey,
        'anthropic-version': ANTHROPIC_VERSION,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: this.model,
        max_tokens: request.maxOutputTokens ?? 1024,
        system: request.systemPrompt,
        messages: request.messages.map((m) => ({ role: m.role, content: toAnthropicContent(m.content) })),
        ...(request.tools && request.tools.length > 0 ? { tools: toAnthropicTools(request.tools) } : {}),
      }),
    });

    if (!response.ok) {
      const bodyText = await response.text().catch(() => '');
      throw new Error(`Anthropic API request failed (${response.status}): ${bodyText.slice(0, 500)}`);
    }

    const body = (await response.json()) as AnthropicResponse;
    const content: AiContentBlock[] = body.content.map((block) => {
      if (block.type === 'tool_use') {
        return { type: 'tool_use', id: block.id ?? '', name: block.name ?? '', input: block.input ?? {} };
      }
      return { type: 'text', text: block.text ?? '' };
    });

    return {
      content,
      stopReason: fromAnthropicStopReason(body.stop_reason),
      provider: this.name,
      model: body.model,
      isSimulated: false,
    };
  }
}
