import type { ReactElement } from 'react';

/**
 * The master spec's Part 7 UI requirement: "clear distinction between
 * verified system state, user-reported state, AI recommendation,
 * external-service state" - mirrors the backend's VerificationStatus enum
 * (SYSTEM_VERIFIED / USER_REPORTED / AI_GENERATED / EXTERNAL_VERIFIED) at a
 * coarser, chat-friendly grain.
 */
export type VerificationKind = 'system' | 'user' | 'ai' | 'external';

const STYLES: Record<VerificationKind, string> = {
  system: 'border-emerald-400/40 bg-emerald-400/10 text-emerald-300',
  user: 'border-cyan-400/40 bg-cyan-400/10 text-cyan-300',
  ai: 'border-fuchsia-400/40 bg-fuchsia-400/10 text-fuchsia-300',
  external: 'border-amber-400/40 bg-amber-400/10 text-amber-300',
};

const LABELS: Record<VerificationKind, string> = {
  system: 'Verified system state',
  user: 'You said',
  ai: 'AI suggestion',
  external: 'External service',
};

export function VerificationTag({ kind }: { kind: VerificationKind }): ReactElement {
  return (
    <span
      className={`inline-flex shrink-0 items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold tracking-wide uppercase backdrop-blur-sm ${STYLES[kind]}`}
    >
      {LABELS[kind]}
    </span>
  );
}
