import { useId, type InputHTMLAttributes, type ReactElement } from 'react';

interface FormFieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'id' | 'onChange'> {
  label: string;
  value: string;
  onChange: (value: string) => void;
  error?: string;
  helperText?: string;
  id?: string;
}

/** Labeled, accessible text input - error/helper text wired via aria-describedby (Part 23: "accessible forms"). */
export function FormField({
  label,
  value,
  onChange,
  error,
  helperText,
  id,
  className = '',
  ...rest
}: FormFieldProps): ReactElement {
  const autoId = useId();
  const fieldId = id ?? autoId;
  const helperId = helperText ? `${fieldId}-helper` : undefined;
  const errorId = error ? `${fieldId}-error` : undefined;
  const describedBy = [helperId, errorId].filter(Boolean).join(' ') || undefined;

  return (
    <div>
      <label htmlFor={fieldId} className="mb-1.5 block text-sm font-medium text-slate-300">
        {label}
      </label>
      <input
        id={fieldId}
        name={fieldId}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        className={`input-field ${className}`.trim()}
        {...rest}
      />
      {helperText ? (
        <p id={helperId} className="mt-1.5 text-xs text-slate-500">
          {helperText}
        </p>
      ) : null}
      {error ? (
        <p id={errorId} role="alert" className="mt-1.5 text-xs text-rose-400">
          {error}
        </p>
      ) : null}
    </div>
  );
}
