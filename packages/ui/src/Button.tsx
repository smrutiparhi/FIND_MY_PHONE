import type { ButtonHTMLAttributes, ReactElement, Ref } from 'react';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
export type ButtonSize = 'sm' | 'md';

const SIZE_CLASSES: Record<ButtonSize, string> = {
  sm: 'px-3 py-1.5 text-xs',
  md: 'px-4 py-2 text-sm',
};

const VARIANT_CLASSES: Record<ButtonVariant, string> = {
  primary: 'btn-primary',
  secondary: 'btn-secondary',
  ghost: 'btn-ghost',
  danger: 'btn-danger',
};

/** For call sites that render a styled `<Link>` or other non-button element instead of `<Button>` itself. */
export function buttonClasses(variant: ButtonVariant = 'secondary', size: ButtonSize = 'md', className = ''): string {
  return `btn ${VARIANT_CLASSES[variant]} ${SIZE_CLASSES[size]} ${className}`.trim();
}

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  ref?: Ref<HTMLButtonElement>;
}

/** React 19: a plain function component can accept `ref` as a normal prop, no forwardRef needed. */
export function Button({
  variant = 'secondary',
  size = 'md',
  type = 'button',
  className = '',
  ref,
  ...rest
}: ButtonProps): ReactElement {
  return <button ref={ref} type={type} className={buttonClasses(variant, size, className)} {...rest} />;
}
