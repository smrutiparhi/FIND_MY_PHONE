import type { ExternalServiceResult } from '../../external/ExternalServiceResult';
import type { NotificationChannelMessage, NotificationChannelProvider } from './NotificationChannelProvider';

/**
 * The only implementation that exists today, for all three channels - no
 * email/push/SMS provider is wired up, so every "send" always reports
 * `not_configured` rather than fabricate delivery. Swapping in a real
 * provider later (see getNotificationChannelProviders.ts) is a drop-in
 * change; nothing that calls a provider needs to know which kind it got.
 */
export class NotConfiguredChannelProvider implements NotificationChannelProvider {
  constructor(readonly channel: 'email' | 'push' | 'sms') {}

  async send(_message: NotificationChannelMessage): Promise<ExternalServiceResult<{ deliveryId: string }>> {
    return { status: 'not_configured', message: `No ${this.channel} provider is configured.` };
  }
}
