import type { ReactElement, ReactNode } from 'react';
import type { Device, PlatformType } from '@recoverai/shared';

const PLATFORM_ICON: Record<PlatformType, string> = {
  ANDROID: '🤖',
  IPHONE: '🍎',
  OTHER: '📱',
};

interface DeviceCardProps {
  device: Pick<Device, 'nickname' | 'manufacturer' | 'model' | 'platform'>;
  selected?: boolean;
  onClick?: () => void;
  trailing?: ReactNode;
}

function DeviceCardBody({ device, trailing }: Pick<DeviceCardProps, 'device' | 'trailing'>): ReactElement {
  return (
    <>
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/5 text-lg" aria-hidden="true">
        {PLATFORM_ICON[device.platform]}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium text-white">{device.nickname}</span>
        <span className="block truncate text-xs text-slate-400">
          {device.manufacturer} {device.model}
        </span>
      </span>
      {trailing}
    </>
  );
}

/** Selectable when `onClick` is given (wizard device picker); a plain summary card otherwise. */
export function DeviceCard({ device, selected = false, onClick, trailing }: DeviceCardProps): ReactElement {
  const className = `glass-panel-hover flex w-full items-center gap-3 rounded-2xl border p-3 text-left transition ${
    selected ? 'border-cyan-400/60 bg-cyan-400/[0.06]' : 'border-white/10 bg-white/[0.02]'
  }`;

  if (onClick) {
    return (
      <button type="button" onClick={onClick} aria-pressed={selected} className={className}>
        <DeviceCardBody device={device} trailing={trailing} />
      </button>
    );
  }

  return (
    <div className={className}>
      <DeviceCardBody device={device} trailing={trailing} />
    </div>
  );
}
