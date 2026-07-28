import type { ReactElement } from 'react';
import type { TriStateAnswer } from '@recoverai/shared';
import { OptionButton } from '../../../components/wizard/OptionButton';

interface Props {
  value: TriStateAnswer | null;
  onChange: (value: TriStateAnswer) => void;
}

export function ScreenLockStep({ value, onChange }: Props): ReactElement {
  return (
    <div className="space-y-2">
      <OptionButton
        selected={value === 'YES'}
        onClick={() => onChange('YES')}
        label="Yes, it was locked"
        description="PIN, pattern, password, or biometric lock"
      />
      <OptionButton selected={value === 'NO'} onClick={() => onChange('NO')} label="No, it wasn't locked" />
      <OptionButton selected={value === 'UNSURE'} onClick={() => onChange('UNSURE')} label="I'm not sure" />
    </div>
  );
}
