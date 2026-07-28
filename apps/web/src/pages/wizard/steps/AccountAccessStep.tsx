import type { ReactElement } from 'react';
import type { TriStateAnswer } from '@recoverai/shared';
import { OptionButton } from '../../../components/wizard/OptionButton';

interface Props {
  value: TriStateAnswer | null;
  onChange: (value: TriStateAnswer) => void;
}

export function AccountAccessStep({ value, onChange }: Props): ReactElement {
  return (
    <div className="space-y-2">
      <OptionButton
        selected={value === 'YES'}
        onClick={() => onChange('YES')}
        label="Yes, I can access it"
        description="I still know the password and can sign in elsewhere"
      />
      <OptionButton selected={value === 'NO'} onClick={() => onChange('NO')} label="No, I can't access it" />
      <OptionButton selected={value === 'UNSURE'} onClick={() => onChange('UNSURE')} label="I'm not sure" />
    </div>
  );
}
