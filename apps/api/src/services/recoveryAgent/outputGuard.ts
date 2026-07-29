/**
 * A mechanical last line of defense against the master spec's "must never"
 * list, applied to the model's own final reply text - prompt instructions
 * (systemPrompt.ts) are the primary control, this is the backstop for when
 * they're not enough. Not a substitute for the prompt: pattern-matching text
 * can't catch every violation, only the most literal ones.
 */
const REQUESTS_CREDENTIALS = /\b(what'?s|what is|please (provide|share|enter|send)|enter your|share your|send (me )?your|type your|reply with your)\b[^.?!\n]{0,40}\b(password|passcode|pin code|upi pin)\b/i;

const CLAIMS_IDENTIFIER_TRACKING =
  /\btrack(ing)?\b[^.?!\n]{0,40}\b(imei|phone number|mobile number)\b|\b(imei|phone number|mobile number)\b[^.?!\n]{0,40}\btrack(ing)?\b/i;

const LOOKS_LIKE_COORDINATES = /-?\d{1,3}\.\d{3,}\s*,\s*-?\d{1,3}\.\d{3,}/;

export interface OutputGuardResult {
  safe: boolean;
  reason?: string;
}

export function checkAgentReply(replyText: string, locationAvailable: boolean): OutputGuardResult {
  if (REQUESTS_CREDENTIALS.test(replyText)) {
    return { safe: false, reason: 'reply appears to request a password/PIN/OTP' };
  }
  if (CLAIMS_IDENTIFIER_TRACKING.test(replyText)) {
    return { safe: false, reason: 'reply appears to claim phone-number/IMEI tracking capability' };
  }
  if (!locationAvailable && LOOKS_LIKE_COORDINATES.test(replyText)) {
    return { safe: false, reason: 'reply appears to state coordinates while no location observation exists' };
  }
  return { safe: true };
}

export const SAFE_FALLBACK_REPLY =
  "I can't share that response as written - it may have asked for something RecoverAI should never request, or stated something not actually confirmed in this case. Could you tell me what you'd like to do next, and I'll try again?";
