import type { FinancialCategoryGuide, FinancialItemCategory } from '@recoverai/shared';

/**
 * Deterministic, not AI-generated - same "rules, not a prompt" discipline as
 * Parts 9/11. Every instruction is an action the user takes directly with
 * the provider, never something that requires giving RecoverAI a PIN,
 * password, CVV, card number, or OTP.
 */
const CATEGORY_GUIDES: Record<FinancialItemCategory, FinancialCategoryGuide> = {
  UPI: {
    category: 'UPI',
    label: 'UPI apps',
    instructions:
      "Open the UPI app (Google Pay, PhonePe, Paytm, etc.) on another device and use its \"log out from all devices\" or \"deregister this device\" option. Most UPI providers support this without needing the lost phone.",
  },
  BANKING_APP: {
    category: 'BANKING_APP',
    label: 'Banking apps',
    instructions:
      "Sign in to your bank's website or app on a device you control and use \"log out of all sessions\" or \"block mobile banking access\", then re-register mobile banking only once you have a secured device.",
  },
  DIGITAL_WALLET: {
    category: 'DIGITAL_WALLET',
    label: 'Digital wallets',
    instructions:
      'Open the wallet provider on another device and deactivate or sign this device out; freeze the wallet if that option exists while you sort everything else out.',
  },
  SAVED_CARD: {
    category: 'SAVED_CARD',
    label: 'Saved cards',
    instructions:
      "Contact the issuing bank directly and ask them to block or reissue the card if it was saved in any app on the device - don't wait to confirm whether it was actually exposed.",
  },
  BANKING_EMAIL: {
    category: 'BANKING_EMAIL',
    label: 'Email used for banking',
    instructions:
      "Change this email account's password from a device you control, and check its \"recent activity\" or \"connected devices\" page to sign the lost device out.",
  },
  PASSWORD_MANAGER: {
    category: 'PASSWORD_MANAGER',
    label: 'Password manager',
    instructions:
      'Sign in to your password manager from another device and use its "sign out all other sessions" or "deauthorize device" option, then rotate your most sensitive saved passwords.',
  },
};

export function getFinancialCategoryGuide(category: FinancialItemCategory): FinancialCategoryGuide {
  return CATEGORY_GUIDES[category];
}

export function listFinancialCategoryGuides(): FinancialCategoryGuide[] {
  return Object.values(CATEGORY_GUIDES);
}
