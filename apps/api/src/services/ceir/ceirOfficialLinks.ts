import type { CeirOfficialLink } from '@recoverai/shared';

/**
 * "Provide links/actions only to verified official government destinations
 * configured by the application" (master spec) - a fixed list, not
 * per-device matching like Part 11's carrier directory, since CEIR is a
 * single national system regardless of carrier or device. Both URLs are
 * real, independently-verified Government of India destinations as of this
 * writing (Department of Telecommunications' Sanchar Saathi citizen portal).
 */
export const CEIR_OFFICIAL_LINKS: CeirOfficialLink[] = [
  {
    key: 'ceir_block_request',
    label: 'Block your lost/stolen mobile (CEIR)',
    url: 'https://ceir.sancharsaathi.gov.in/Home/index.jsp',
    description:
      'File the official IMEI-blocking request here. You will need your mobile number, device details (IMEI), and a copy of your police complaint. You get a Request ID after submitting - record it below once you have it.',
  },
  {
    key: 'sanchar_saathi_portal',
    label: 'Sanchar Saathi citizen portal',
    url: 'https://sancharsaathi.gov.in',
    description:
      "The Department of Telecommunications' citizen portal that CEIR is part of - useful for checking your request status or finding other official mobile-security services.",
  },
];
