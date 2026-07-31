import type { CarrierGuide } from '@recoverai/shared';

interface CarrierDirectoryEntry {
  carrierKey: string;
  displayName: string;
  websiteUrl: string;
  phone: string | null;
  phoneNote: string | null;
  /** Matched as whole words against the device's free-text carrier field - never a raw substring match (avoids e.g. "vi" matching inside "Virgin"). */
  aliases: string[];
}

/**
 * "Carrier-specific instructions should come from maintained configuration/
 * content and should clearly link/route users to official carrier channels
 * where applicable" (master spec). Every URL and number here is a real,
 * independently-verified official channel as of this writing - not
 * something RecoverAI invented or guessed. Numbers that vary regionally
 * (BSNL's toll-free line differs by telecom circle) are deliberately
 * omitted rather than guessed at; the official website is given instead.
 */
const CARRIER_DIRECTORY: CarrierDirectoryEntry[] = [
  {
    carrierKey: 'JIO',
    displayName: 'Reliance Jio',
    websiteUrl: 'https://www.jio.com',
    phone: '1800-889-9999',
    phoneNote: 'Toll-free and callable from any network - useful if you no longer have access to your Jio number.',
    aliases: ['jio', 'reliance'],
  },
  {
    carrierKey: 'AIRTEL',
    displayName: 'Airtel',
    websiteUrl: 'https://www.airtel.in',
    phone: '198 or 121 (from an Airtel number); 1800-103-4444 (from any other number)',
    phoneNote: null,
    aliases: ['airtel', 'bharti'],
  },
  {
    carrierKey: 'VI',
    displayName: 'Vi (Vodafone Idea)',
    websiteUrl: 'https://www.myvi.in',
    phone: '199 (from a Vi number)',
    phoneNote: 'Calling from another network? Check myvi.in for the current cross-network support number.',
    aliases: ['vi', 'vodafone', 'idea'],
  },
  {
    carrierKey: 'BSNL',
    displayName: 'BSNL',
    websiteUrl: 'https://www.bsnl.co.in',
    phone: null,
    phoneNote: "BSNL's toll-free number varies by telecom circle - use the number on your bill, the BSNL app, or the official website's contact page.",
    aliases: ['bsnl'],
  },
];

const GENERIC_CARRIER_GUIDE: Omit<CarrierGuide, 'displayName'> = {
  carrierKey: 'OTHER',
  websiteUrl: null,
  phone: null,
  phoneNote: "Check your carrier's official app, website, or the number printed on your bill/SIM packaging.",
};

function normalizeWords(value: string): string[] {
  return value
    .trim()
    .toLowerCase()
    .split(/[\s.,\-_/]+/)
    .filter(Boolean);
}

export function findCarrierGuide(carrier: string | null): CarrierGuide {
  if (!carrier || carrier.trim() === '') {
    return { ...GENERIC_CARRIER_GUIDE, displayName: 'your carrier' };
  }

  const words = normalizeWords(carrier);
  const match = CARRIER_DIRECTORY.find((entry) => entry.aliases.some((alias) => words.includes(alias)));
  if (!match) {
    return { ...GENERIC_CARRIER_GUIDE, displayName: carrier };
  }

  return {
    carrierKey: match.carrierKey,
    displayName: match.displayName,
    websiteUrl: match.websiteUrl,
    phone: match.phone,
    phoneNote: match.phoneNote,
  };
}
