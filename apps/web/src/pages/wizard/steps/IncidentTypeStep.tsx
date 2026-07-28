import type { ReactElement } from 'react';
import type { IncidentType } from '@recoverai/shared';
import { OptionButton } from '../../../components/wizard/OptionButton';

interface Props {
  value: IncidentType | null;
  onChange: (value: IncidentType) => void;
}

const OPTIONS: { value: IncidentType; label: string; description: string }[] = [
  { value: 'LOST', label: 'Lost', description: 'I misplaced it, but no one else took it.' },
  { value: 'STOLEN', label: 'Stolen', description: 'Someone took it, or I strongly suspect they did.' },
  { value: 'UNSURE', label: "I'm not sure", description: "It's missing and I don't know what happened." },
];

export function IncidentTypeStep({ value, onChange }: Props): ReactElement {
  return (
    <div className="space-y-2">
      {OPTIONS.map((option) => (
        <OptionButton
          key={option.value}
          selected={value === option.value}
          onClick={() => onChange(option.value)}
          label={option.label}
          description={option.description}
        />
      ))}
    </div>
  );
}
