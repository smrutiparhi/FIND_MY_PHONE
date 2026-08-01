import type { ReactElement, ReactNode } from 'react';

export function FormMessage({
  tone,
  children,
}: {
  tone: 'error' | 'success';
  children: ReactNode;
}): ReactElement {
  const styles = tone === 'error' ? 'glass-panel-danger text-rose-300' : 'glass-panel-success text-emerald-300';
  return (
    <div className={`px-3 py-2 text-sm ${styles}`} role={tone === 'error' ? 'alert' : 'status'}>
      {children}
    </div>
  );
}
