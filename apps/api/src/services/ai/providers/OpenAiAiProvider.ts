import type {
  AiChatMessage,
  AiCompletionRequest,
  AiCompletionResult,
  AiContentBlock,
  AiProvider,
  AiStopReason,
  AiToolDefinition,
} from '../AiProvider';

const API_URL = 'https://api.openai.com/v1/chat/completions';

interface OpenAiToolCall {
  id: string;
  type: 'function';
  function: { name: string; arguments: string };
}

/**
 * OpenAI's Chat Completions transcript is flatter than the generic
 * AiChatMessage shape this app uses: a tool call and its result are each
 * their own message (role 'assistant' with `tool_calls`, then one role
 * 'tool' message per call) rather than content blocks inside a single
 * user/assistant turn. This expands one AiChatMessage into zero or more
 * OpenAI messages to bridge that.
 */
function toOpenAiMessages(messages: AiChatMessage[]): unknown[] {
  const result: unknown[] = [];
  for (const message of messages) {
    if (typeof message.content === 'string') {
      result.push({ role: message.role, content: message.content });
      continue;
    }

    const toolResults = message.content.filter((b) => b.type === 'tool_result');
    if (toolResults.length > 0) {
      for (const block of toolResults) {
        if (block.type !== 'tool_result') continue;
        result.push({ role: 'tool', tool_call_id: block.toolUseId, content: block.content });
      }
      continue;
    }

    const text = message.content
      .filter((b) => b.type === 'text')
      .map((b) => (b.type === 'text' ? b.text : ''))
      .join('\n');
    const toolCalls: OpenAiToolCall[] = message.content
      .filter((b) => b.type === 'tool_use')
      .map((b) => (b.type === 'tool_use' ? { id: b.id, type: 'function' as const, function: { name: b.name, arguments: JSON.stringify(b.input) } } : null))
      .filter((b): b is OpenAiToolCall => b !== null);

    result.push({
      role: message.role,
      content: text.length > 0 ? text : null,
      ...(toolCalls.length > 0 ? { tool_calls: toolCalls } : {}),
    });
  }
  return result;
}

function toOpenAiTools(tools: AiToolDefinition[]): unknown[] {
  return tools.map((tool) => ({
    type: 'function',
    function: { name: tool.name, description: tool.description, parameters: tool.parameters },
  }));
}

function fromOpenAiFinishReason(reason: string): AiStopReason {
  if (reason === 'tool_calls') return 'tool_use';
  if (reason === 'length') return 'max_tokens';
  return 'end_turn';
}

interface OpenAiResponse {
  choices: {
    message: { content: string | null; tool_calls?: OpenAiToolCall[] };
    finish_reason: string;
  }[];
  model: string;
}

/** Talks to the OpenAI Chat Completions API directly over `fetch` - see AnthropicAiProvider for why no SDK. */
export class OpenAiAiProvider implements AiProvider {
  readonly name = 'openai';

  constructor(
    private readonly apiKey: string,
    private readonly model: string,
  ) {}

  async generateCompletion(request: AiCompletionRequest): Promise<AiCompletionResult> {
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: this.model,
        max_tokens: request.maxOutputTokens ?? 1024,
        messages: [{ role: 'system', content: request.systemPrompt }, ...toOpenAiMessages(request.messages)],
        ...(request.tools && request.tools.length > 0 ? { tools: toOpenAiTools(request.tools), tool_choice: 'auto' } : {}),
      }),
    });

    if (!response.ok) {
      const bodyText = await response.text().catch(() => '');
      throw new Error(`OpenAI API request failed (${response.status}): ${bodyText.slice(0, 500)}`);
    }

    const body = (await response.json()) as OpenAiResponse;
    const choice = body.choices[0];
    if (!choice) throw new Error('OpenAI API returned no choices');

    const content: AiContentBlock[] = [];
    if (choice.message.content) content.push({ type: 'text', text: choice.message.content });
    for (const call of choice.message.tool_calls ?? []) {
      let input: Record<string, unknown> = {};
      try {
        input = JSON.parse(call.function.arguments) as Record<string, unknown>;
      } catch {
        input = {};
      }
      content.push({ type: 'tool_use', id: call.id, name: call.function.name, input });
    }

    return {
      content,
      stopReason: fromOpenAiFinishReason(choice.finish_reason),
      provider: this.name,
      model: body.model,
      isSimulated: false,
    };
  }
}
