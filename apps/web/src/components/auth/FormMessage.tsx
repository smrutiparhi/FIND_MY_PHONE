import type { ReactElement, ReactNode } from 'react';

export function FormMessage({
  tone,
  children,
}: {
  tone: 'error' | 'success';
  children: ReactNode;
}): ReactElement {
  const styles =
    tone === 'error'
      ? 'border-red-900 bg-red-950 text-red-300'
      : 'border-emerald-900 bg-emerald-950 text-emerald-300';
  return (
    <div
      className={`rounded-md border px-3 py-2 text-sm ${styles}`}
      role={tone === 'error' ? 'alert' : 'status'}
    >
      {children}
    </div>
  );
}
