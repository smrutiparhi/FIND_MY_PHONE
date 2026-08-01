import type { ExternalServiceResult } from '../../external/ExternalServiceResult';

export interface NotificationChannelMessage {
  /** The provider-specific address - an email address, device push token, or phone number. Never logged or persisted by a provider implementation. */
  to: string;
  title: string;
  body: string;
}

/**
 * "Design provider abstractions for future: email, push notifications, SMS
 * where legally and technically appropriate" (master spec, verbatim). The
 * interface every future real integration (SendGrid, FCM/APNs, Twilio, ...)
 * implements - mirrors AiProvider's shape (Part 7) and returns the same
 * ExternalServiceResult discriminated union every external integration in
 * this app uses, so a caller can never mistake "not configured" for
 * "delivered".
 */
export interface NotificationChannelProvider {
  readonly channel: 'email' | 'push' | 'sms';
  send(message: NotificationChannelMessage): Promise<ExternalServiceResult<{ deliveryId: string }>>;
}
