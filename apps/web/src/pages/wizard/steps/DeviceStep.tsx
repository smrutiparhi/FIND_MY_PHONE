import type { ReactElement } from 'react';
import type { Device, DeviceId, PlatformType } from '@recoverai/shared';
import { OptionButton } from '../../../components/wizard/OptionButton';
import { FormField, DeviceCard } from '@recoverai/ui';

interface NewDeviceFields {
  nickname: string;
  manufacturer: string;
  model: string;
  platform: PlatformType | null;
}

interface Props {
  devices: Device[];
  deviceMode: 'existing' | 'new' | null;
  existingDeviceId: DeviceId | null;
  newDevice: NewDeviceFields;
  onSelectExisting: (deviceId: DeviceId) => void;
  onSelectNew: () => void;
  onChangeNewDevice: (patch: Partial<NewDeviceFields>) => void;
}

const PLATFORM_OPTIONS: { value: PlatformType; label: string }[] = [
  { value: 'ANDROID', label: 'Android' },
  { value: 'IPHONE', label: 'iPhone' },
  { value: 'OTHER', label: 'Other' },
];

export function DeviceStep({
  devices,
  deviceMode,
  existingDeviceId,
  newDevice,
  onSelectExisting,
  onSelectNew,
  onChangeNewDevice,
}: Props): ReactElement {
  const showNewDeviceForm = deviceMode === 'new' || devices.length === 0;

  return (
    <div className="space-y-4">
      {devices.length > 0 ? (
        <div className="space-y-2">
          {devices.map((device) => (
            <DeviceCard
              key={device.id}
              device={device}
              selected={deviceMode === 'existing' && existingDeviceId === device.id}
              onClick={() => onSelectExisting(device.id)}
            />
          ))}
          <OptionButton
            selected={deviceMode === 'new'}
            onClick={onSelectNew}
            label="A different device"
            description="Add details for a device not listed above"
          />
        </div>
      ) : null}

      {showNewDeviceForm ? (
        <div className="space-y-3 glass-panel p-4">
          <FormField
            id="nickname"
            label="What do you call this device?"
            value={newDevice.nickname}
            onChange={(nickname) => onChangeNewDevice({ nickname })}
            required
          />
          <FormField
            id="manufacturer"
            label="Manufacturer"
            value={newDevice.manufacturer}
            onChange={(manufacturer) => onChangeNewDevice({ manufacturer })}
            required
          />
          <FormField id="model" label="Model" value={newDevice.model} onChange={(model) => onChangeNewDevice({ model })} required />
          <div>
            <p className="mb-1 block text-sm font-medium text-slate-300">Platform</p>
            <div className="grid grid-cols-3 gap-2">
              {PLATFORM_OPTIONS.map((option) => (
                <OptionButton
                  key={option.value}
                  selected={newDevice.platform === option.value}
                  onClick={() => onChangeNewDevice({ platform: option.value })}
                  label={option.label}
                />
              ))}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
