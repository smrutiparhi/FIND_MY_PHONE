import { useEffect, useRef, useState, type FormEvent, type ReactElement } from 'react';
import type { AiAgentChatMessage, RecoveryCase, RecoveryCaseId, RecoveryPlan, SendAgentMessageResult } from '@recoverai/shared';
import { AI_AGENT_CHAT_MESSAGE_LIMITS } from '@recoverai/shared';
import { ApiClientError, apiPost } from '../../lib/apiClient';
import { AgentPanel, Button, VerificationTag } from '@recoverai/ui';

function storageKey(caseId: RecoveryCaseId): string {
  return `recoverai:agent-chat:${caseId}`;
}

function loadHistory(caseId: RecoveryCaseId): AiAgentChatMessage[] {
  try {
    const raw = sessionStorage.getItem(storageKey(caseId));
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as AiAgentChatMessage[]) : [];
  } catch {
    return [];
  }
}

function describeError(err: unknown): string {
  if (err instanceof ApiClientError) return err.message;
  if (err instanceof Error) return err.message;
  return 'Something went wrong sending that message.';
}

interface AgentChatPanelProps {
  caseId: RecoveryCaseId;
  onCaseUpdated: (recoveryCase: RecoveryCase, recoveryPlan: RecoveryPlan) => void;
}

/**
 * Conversation history lives only in this tab's sessionStorage, never the
 * database - the master spec says to "store useful case events, not
 * unnecessary sensitive conversation data," so every state-changing thing
 * the agent does is recorded as a TimelineEvent server-side (source
 * AI_AGENT) instead, and the raw chat transcript is resent fresh each turn.
 * See docs/AI_RECOVERY_AGENT.md.
 */
export function AgentChatPanel({ caseId, onCaseUpdated }: AgentChatPanelProps): ReactElement {
  const [messages, setMessages] = useState<AiAgentChatMessage[]>(() => loadHistory(caseId));
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastWasSimulated, setLastWasSimulated] = useState(false);
  const [lastToolCalls, setLastToolCalls] = useState<{ tool: string; summary: string }[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    sessionStorage.setItem(storageKey(caseId), JSON.stringify(messages));
  }, [caseId, messages]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [messages, sending]);

  async function handleSubmit(e: FormEvent): Promise<void> {
    e.preventDefault();
    const text = draft.trim();
    if (!text || sending) return;

    const nextMessages = [...messages, { role: 'user' as const, content: text }];
    setMessages(nextMessages);
    setDraft('');
    setError(null);
    setSending(true);

    try {
      const transcript = nextMessages.slice(-AI_AGENT_CHAT_MESSAGE_LIMITS.maxMessages);
      const result = await apiPost<SendAgentMessageResult>(`/api/recovery-cases/${caseId}/agent/messages`, {
        messages: transcript,
      });
      setMessages((prev) => [...prev, { role: 'assistant', content: result.reply }]);
      setLastWasSimulated(result.isSimulated);
      setLastToolCalls(result.toolCalls);
      onCaseUpdated(result.recoveryCase, result.recoveryPlan);
    } catch (err) {
      setError(describeError(err));
    } finally {
      setSending(false);
    }
  }

  return (
    <AgentPanel
      title="Recovery Agent"
      scrollRef={scrollRef}
      error={error}
      badge={
        lastWasSimulated ? (
          <span className="inline-flex items-center rounded-full border border-amber-400/40 bg-amber-400/10 px-2 py-0.5 text-[10px] font-semibold text-amber-300">
            DEMO AI PROVIDER
          </span>
        ) : null
      }
      footer={
        <form onSubmit={(e) => void handleSubmit(e)} className="flex items-center gap-2">
          <input
            type="text"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            maxLength={AI_AGENT_CHAT_MESSAGE_LIMITS.maxMessageLength}
            placeholder="Type a message..."
            disabled={sending}
            aria-label="Message the Recovery Agent"
            className="input-field flex-1 disabled:opacity-60"
          />
          <Button type="submit" variant="primary" disabled={sending || draft.trim().length === 0}>
            Send
          </Button>
        </form>
      }
    >
      {messages.length === 0 ? (
        <p className="text-sm text-slate-500">
          Ask about what happened, what to do next, or tell me anything new (e.g. &quot;I found my phone&quot; or &quot;I
          have UPI apps on it&quot;).
        </p>
      ) : null}
      {messages.map((message, index) => (
        <div key={index} className={`flex flex-col gap-1 ${message.role === 'user' ? 'items-end' : 'items-start'}`}>
          <VerificationTag kind={message.role === 'user' ? 'user' : 'ai'} />
          <div
            className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm whitespace-pre-wrap ${
              message.role === 'user' ? 'bg-cyan-500/20 text-cyan-50' : 'bg-white/5 text-slate-100'
            }`}
          >
            {message.content}
          </div>
        </div>
      ))}
      {lastToolCalls.length > 0 ? (
        <div className="space-y-1">
          {lastToolCalls.map((call, index) => (
            <div key={index} className="flex items-center gap-2">
              <VerificationTag kind="system" />
              <span className="text-xs text-emerald-300">{call.summary}</span>
            </div>
          ))}
        </div>
      ) : null}
      {sending ? <p className="text-xs text-slate-500">Thinking...</p> : null}
    </AgentPanel>
  );
}
