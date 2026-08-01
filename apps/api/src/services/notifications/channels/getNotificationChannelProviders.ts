import type { NotificationChannelProvider } from './NotificationChannelProvider';
import { NotConfiguredChannelProvider } from './NotConfiguredChannelProvider';

/**
 * Provider factory, mirroring services/ai/index.ts's getAiProvider() - the
 * one place that would branch on a future EMAIL_PROVIDER/PUSH_PROVIDER/
 * SMS_PROVIDER env var to pick a real implementation. None exists yet, so
 * every channel always resolves to the not-configured stub; callers never
 * need to change when a real one is added.
 */
export function getNotificationChannelProviders(): Record<'email' | 'push' | 'sms', NotificationChannelProvider> {
  return {
    email: new NotConfiguredChannelProvider('email'),
    push: new NotConfiguredChannelProvider('push'),
    sms: new NotConfiguredChannelProvider('sms'),
  };
}
