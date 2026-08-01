import type { ReactElement } from 'react';
import { Link } from 'react-router-dom';
import type { DeviceRecoveryChecklistItem, RecoveryCaseId } from '@recoverai/shared';
import { DEVICE_RECOVERY_CHECKLIST_INFO } from './deviceRecoveryChecklistLabels';

interface DeviceRecoveryChecklistRowProps {
  item: DeviceRecoveryChecklistItem;
  caseId: RecoveryCaseId;
  checked: boolean;
  disabled: boolean;
  onToggle: (item: DeviceRecoveryChecklistItem, checked: boolean) => void;
}

export function DeviceRecoveryChecklistRow({ item, caseId, checked, disabled, onToggle }: DeviceRecoveryChecklistRowProps): ReactElement {
  const info = DEVICE_RECOVERY_CHECKLIST_INFO[item];
  const route = info.route ? info.route(caseId) : null;

  return (
    <li className="flex items-start gap-3 glass-panel-inset rounded-2xl p-3">
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onToggle(item, e.target.checked)}
        className="mt-0.5 h-4 w-4 shrink-0 rounded border-white/20 bg-white/[0.04] disabled:cursor-not-allowed"
      />
      <div className="min-w-0 flex-1">
        <p className={`text-sm font-medium ${checked ? 'text-slate-400 line-through decoration-slate-600' : 'text-white'}`}>
          {info.label}
        </p>
        <p className="mt-0.5 text-xs text-slate-500">{info.description}</p>
        {route ? (
          <Link to={route} className="mt-1 inline-block text-xs font-medium text-cyan-300 hover:underline">
            Open &rarr;
          </Link>
        ) : null}
      </div>
    </li>
  );
}
