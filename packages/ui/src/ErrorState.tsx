import type { ReactElement } from 'react';
import { Button } from './Button';

interface ErrorStateProps {
  message: string;
  onRetry?: () => void;
  title?: string;
}

export function ErrorState({ message, onRetry, title = 'Something went wrong.' }: ErrorStateProps): ReactElement {
  return (
    <div className="glass-panel-danger p-5 text-sm" role="alert">
      <p className="font-medium text-rose-300">{title}</p>
      <p className="mt-1 text-rose-300/80">{message}</p>
      {onRetry ? (
        <Button variant="secondary" size="sm" className="mt-3" onClick={onRetry}>
          Try again
        </Button>
      ) : null}
    </div>
  );
}

export function InlineError({ children }: { children: ReactElement | string }): ReactElement {
  return (
    <p role="alert" className="text-sm text-rose-400">
      {children}
    </p>
  );
}
