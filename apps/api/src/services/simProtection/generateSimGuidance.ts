import type { IncidentType, SimGuidanceSection, SimType } from '@recoverai/shared';

/**
 * Deterministic, not AI-generated - same "rules, not a prompt" discipline as
 * Part 9's account-recovery path. Covers exactly the master spec's Part 11
 * checklist: SIM blocking, eSIM considerations, replacement SIM,
 * mobile-number recovery, impact on OTPs, account recovery after number
 * restoration.
 */
export function generateSimGuidance(input: { simType: SimType; incidentType: IncidentType }): SimGuidanceSection[] {
  const sections: SimGuidanceSection[] = [];

  sections.push({
    key: 'sim_blocking',
    title: 'Block your SIM',
    body:
      input.incidentType === 'STOLEN'
        ? "Block your SIM as soon as possible - whoever has the device can use it to receive OTPs and reset your accounts. Contact your carrier through the official channel below and ask them to block the SIM tied to this number."
        : "If you can't rule out someone else finding and using the device, blocking the SIM prevents your number from being used to intercept OTPs. Contact your carrier through the official channel below.",
  });

  if (input.simType === 'ESIM' || input.simType === 'DUAL') {
    sections.push({
      key: 'esim_considerations',
      title: 'eSIM considerations',
      body: "An eSIM can't be physically removed the way a plastic SIM can - it stays tied to the device. Ask your carrier specifically to deactivate the eSIM profile when you request a block; someone with the device unlocked could otherwise still re-provision or transfer that profile.",
    });
  } else {
    sections.push({
      key: 'esim_considerations',
      title: 'eSIM considerations',
      body: "This device uses a physical SIM, not an eSIM, so eSIM profile-transfer risk doesn't apply here.",
    });
  }

  sections.push({
    key: 'replacement_sim',
    title: 'Get a replacement SIM',
    body: 'Once your old SIM is blocked, request a replacement with the same number from your carrier - usually in person with ID proof, though some carriers support this through their app. This can take anywhere from a few hours to a couple of days.',
  });

  sections.push({
    key: 'mobile_number_recovery',
    title: 'Recovering access to your number',
    body: "A replacement SIM restores your original phone number - calls, SMS, and OTPs start arriving on it again once it's activated. Keep the new SIM in a device only you control.",
  });

  sections.push({
    key: 'otp_impact',
    title: 'Impact on OTPs',
    body: "Until your replacement SIM is active, anything that sends a one-time code to this number - banking apps, account recovery, two-factor authentication - won't reach you. Avoid starting an SMS-code-based recovery flow until the SIM is back.",
  });

  sections.push({
    key: 'account_recovery_after_restoration',
    title: 'Account recovery after your number is back',
    body: 'Once your number is active again, phone-based account recovery (Apple/Google account, banking, etc.) becomes available. See Account Recovery Mode for a guided path.',
  });

  return sections;
}
