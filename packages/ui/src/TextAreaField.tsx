import { useId, type ReactElement, type TextareaHTMLAttributes } from 'react';

interface TextAreaFieldProps extends Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, 'id' | 'onChange'> {
  label: string;
  value: string;
  onChange: (value: string) => void;
  helperText?: string;
  id?: string;
}

export function TextAreaField({
  label,
  value,
  onChange,
  helperText,
  id,
  className = '',
  ...rest
}: TextAreaFieldProps): ReactElement {
  const autoId = useId();
  const fieldId = id ?? autoId;
  const helperId = helperText ? `${fieldId}-helper` : undefined;

  return (
    <div>
      <label htmlFor={fieldId} className="mb-1.5 block text-sm font-medium text-slate-300">
        {label}
      </label>
      <textarea
        id={fieldId}
        name={fieldId}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        aria-describedby={helperId}
        className={`input-field ${className}`.trim()}
        {...rest}
      />
      {helperText ? (
        <p id={helperId} className="mt-1.5 text-xs text-slate-500">
          {helperText}
        </p>
      ) : null}
    </div>
  );
}
