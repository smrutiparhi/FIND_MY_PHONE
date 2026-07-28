import type { ReactElement } from 'react';
import type { SensitiveAppType } from '@recoverai/shared';
import { CheckboxOption } from '../../../components/wizard/CheckboxOption';

interface Props {
  value: SensitiveAppType[];
  onChange: (value: SensitiveAppType[]) => void;
}

const OPTIONS: { value: SensitiveAppType; label: string }[] = [
  { value: 'BANKING', label: 'Banking apps' },
  { value: 'UPI', label: 'UPI apps' },
  { value: 'EMAIL', label: 'Email' },
  { value: 'SOCIAL_MEDIA', label: 'Social media' },
  { value: 'PASSWORD_MANAGER', label: 'Password manager' },
  { value: 'AUTHENTICATOR', label: 'Authenticator app' },
  { value: 'WORK_ACCOUNTS', label: 'Work accounts' },
];

export function SensitiveAppsStep({ value, onChange }: Props): ReactElement {
  function toggle(app: SensitiveAppType, checked: boolean): void {
    onChange(checked ? [...value, app] : value.filter((existing) => existing !== app));
  }

  return (
    <div className="space-y-2">
      {OPTIONS.map((option) => (
        <CheckboxOption
          key={option.value}
          checked={value.includes(option.value)}
          onChange={(checked) => toggle(option.value, checked)}
          label={option.label}
        />
      ))}
      <p className="pt-1 text-xs text-slate-500">Select any that apply - it&apos;s fine to select none.</p>
    </div>
  );
}
