import type { ReactElement } from 'react';
import type { SimAccessStatus } from '@recoverai/shared';
import { OptionButton } from '../../../components/wizard/OptionButton';

interface Props {
  value: SimAccessStatus | null;
  onChange: (value: SimAccessStatus) => void;
}

const OPTIONS: { value: SimAccessStatus; label: string; description?: string }[] = [
  {
    value: 'ANOTHER_DEVICE_HAS_ACCESS',
    label: 'Another device has access',
    description: 'e.g. an eSIM or a second phone on the same number',
  },
  { value: 'LOST_WITH_PHONE', label: 'It was lost with the phone', description: 'The SIM was in the device' },
  {
    value: 'SIM_ALREADY_BLOCKED',
    label: 'The SIM is already blocked',
    description: "I've already contacted my carrier",
  },
  { value: 'UNSURE', label: "I'm not sure" },
];

export function SimAccessStep({ value, onChange }: Props): ReactElement {
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
