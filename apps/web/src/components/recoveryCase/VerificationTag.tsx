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
  system: 'border-emerald-900 bg-emerald-950 text-emerald-300',
  user: 'border-sky-900 bg-sky-950 text-sky-300',
  ai: 'border-violet-900 bg-violet-950 text-violet-300',
  external: 'border-amber-900 bg-amber-950 text-amber-300',
};

const LABELS: Record<VerificationKind, string> = {
  system: 'Verified system state',
  user: 'You said',
  ai: 'AI suggestion',
  external: 'External service',
};

export function VerificationTag({ kind }: { kind: VerificationKind }): ReactElement {
  return (
    <span className={`inline-flex shrink-0 items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold tracking-wide uppercase ${STYLES[kind]}`}>
      {LABELS[kind]}
    </span>
  );
}
