import type { ReactElement } from 'react';
import type { TriStateAnswer } from '@recoverai/shared';
import { OptionButton } from '../../../components/wizard/OptionButton';

interface Props {
  value: TriStateAnswer | null;
  onChange: (value: TriStateAnswer) => void;
}

export function DeviceFindingStep({ value, onChange }: Props): ReactElement {
  return (
    <div className="space-y-2">
      <OptionButton
        selected={value === 'YES'}
        onClick={() => onChange('YES')}
        label="Yes"
        description="I can sign in to Google Find Hub or Apple Find My from another device"
      />
      <OptionButton selected={value === 'NO'} onClick={() => onChange('NO')} label="No" />
      <OptionButton selected={value === 'UNSURE'} onClick={() => onChange('UNSURE')} label="I'm not sure" />
    </div>
  );
}
