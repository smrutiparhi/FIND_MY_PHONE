/**
 * A JSON-schema-ish description of a tool's input, restricted to the plain
 * object/string/boolean/enum shapes the Recovery Agent's tools actually use
 * (see services/recoveryAgent/tools.ts) - not a full JSON Schema dialect,
 * since every provider adapter needs to translate this by hand anyway.
 */
export interface AiToolParameterSchema {
  type: 'object';
  properties: Record<
    string,
    | { type: 'string'; description: string; enum?: string[] }
    | { type: 'boolean'; description: string }
    | { type: 'array'; description: string; items: { type: 'string'; enum?: string[] } }
  >;
  required: string[];
}

export interface AiToolDefinition {
  name: string;
  description: string;
  parameters: AiToolParameterSchema;
}

export interface AiTextBlock {
  type: 'text';
  text: string;
}

export interface AiToolUseBlock {
  type: 'tool_use';
  id: string;
  name: string;
  input: Record<string, unknown>;
}

export interface AiToolResultBlock {
  type: 'tool_result';
  toolUseId: string;
  content: string;
  isError: boolean;
}

/**
 * An assistant message's content is text and/or tool-use requests; a user
 * message's content is text and/or the results of tool calls the caller
 * already executed. Kept as a single union (rather than two message types)
 * because that's what every provider's own multi-turn tool-use transcript
 * looks like - see AnthropicAiProvider/OpenAiProvider for the translation.
 */
export type AiContentBlock = AiTextBlock | AiToolUseBlock | AiToolResultBlock;

export interface AiChatMessage {
  role: 'user' | 'assistant';
  content: string | AiContentBlock[];
}

export interface AiCompletionRequest {
  systemPrompt: string;
  messages: AiChatMessage[];
  tools?: AiToolDefinition[];
  maxOutputTokens?: number;
}

export type AiStopReason = 'end_turn' | 'tool_use' | 'max_tokens';

export interface AiCompletionResult {
  content: AiContentBlock[];
  stopReason: AiStopReason;
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
 * recommendation but must never override mandatory security rules. Nothing
 * here lets a tool call bypass evaluateRecoveryDecision() - the Recovery
 * Agent's tools only ever update the *inputs* the engine reads (an action's
 * status, a corrected incident answer) and then re-run the real engine - see
 * services/recoveryAgent/toolHandlers.ts.
 */
export interface AiProvider {
  readonly name: string;
  generateCompletion(request: AiCompletionRequest): Promise<AiCompletionResult>;
}
