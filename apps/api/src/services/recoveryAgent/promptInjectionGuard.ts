const OPEN_TAG = '<untrusted_user_supplied_data>';
const CLOSE_TAG = '</untrusted_user_supplied_data>';

/**
 * Fences free text that a user (or, once Part 15's Evidence Vault exists,
 * OCR'd/uploaded evidence) typed into a field the model will read, so it's
 * unambiguously data to reason about rather than instructions to follow -
 * "implement prompt-injection resistance for uploaded evidence and external
 * content" per the master spec. There's no evidence upload yet to fence, but
 * every free-text case field (last-seen description today; evidence text
 * once it exists) should be wrapped through this one helper so the pattern
 * is consistent everywhere untrusted text enters a prompt.
 */
export function wrapUntrustedContent(label: string, text: string | null | undefined): string | null {
  const trimmed = text?.trim();
  if (!trimmed) return null;
  return `${label}:\n${OPEN_TAG}\n${trimmed}\n${CLOSE_TAG}`;
}
