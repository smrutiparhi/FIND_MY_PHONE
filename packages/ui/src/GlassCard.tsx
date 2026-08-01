import type { HTMLAttributes, ReactElement } from 'react';

type Padding = 'none' | 'sm' | 'md' | 'lg';
type Tone = 'default' | 'inset' | 'danger' | 'critical' | 'success';

const PADDING_CLASSES: Record<Padding, string> = {
  none: '',
  sm: 'p-3',
  md: 'p-5',
  lg: 'p-6',
};

const TONE_CLASSES: Record<Tone, string> = {
  default: 'glass-panel',
  inset: 'glass-panel-inset',
  danger: 'glass-panel-danger',
  critical: 'glass-panel-critical',
  success: 'glass-panel-success',
};

interface GlassCardProps extends HTMLAttributes<HTMLDivElement> {
  padding?: Padding;
  tone?: Tone;
  hover?: boolean;
}

/** The base frosted-glass surface every card in the app is built on (Part 23). */
export function GlassCard({
  padding = 'md',
  tone = 'default',
  hover = false,
  className = '',
  children,
  ...rest
}: GlassCardProps): ReactElement {
  const hoverClass = hover ? 'glass-panel-hover' : '';
  return (
    <div className={`${TONE_CLASSES[tone]} ${hoverClass} ${PADDING_CLASSES[padding]} ${className}`.trim()} {...rest}>
      {children}
    </div>
  );
}
