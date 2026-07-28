import type { ReactElement, ReactNode } from 'react';

export function AuthSubmitButton({
  children,
  disabled,
}: {
  children: ReactNode;
  disabled?: boolean;
}): ReactElement {
  return (
    <button
      type="submit"
      disabled={disabled}
      className="w-full rounded-md bg-sky-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-sky-400 disabled:cursor-not-allowed disabled:opacity-60"
    >
      {children}
    </button>
  );
}
