import type { CeirGuidanceSection, IncidentType } from '@recoverai/shared';
import type { PoliceReportEngineStatus } from '../recoveryEngine/types';

/**
 * Deterministic, not AI-generated - same "rules, not a prompt" discipline as
 * Parts 9/11. Every sentence is written to satisfy the master spec's "never
 * claim RecoverAI itself can block an IMEI" - CEIR blocking is something
 * only the government portal does, RecoverAI only helps prepare for and
 * track it.
 */
export function generateCeirGuidance(input: {
  incidentType: IncidentType;
  policeReportStatus: PoliceReportEngineStatus;
}): CeirGuidanceSection[] {
  const sections: CeirGuidanceSection[] = [];

  sections.push({
    key: 'what_is_ceir',
    title: 'What CEIR does',
    body: "The Central Equipment Identity Register (CEIR), part of the Government of India's Sanchar Saathi portal, lets you request that your device's IMEI be blocked across every Indian telecom network - making the device unusable on any Indian carrier even with a new SIM. RecoverAI cannot block an IMEI itself; only CEIR can, once you submit a request there.",
  });

  sections.push({
    key: 'police_report_prerequisite',
    title: 'A filed police complaint comes first',
    body:
      input.policeReportStatus === 'FILED'
        ? "You've recorded that your police complaint has been filed - you're ready to submit a CEIR request using the same details."
        : 'CEIR requires a filed police complaint before you can submit a request - use the Police Complaint Assistant first if you haven\'t already.',
  });

  sections.push({
    key: 'what_you_need',
    title: 'What the CEIR form asks for',
    body: 'IMEI (one or both, if you have them), your mobile number, device make/model, your police complaint, a government identity document, your purchase invoice if you still have it, and details of any replacement SIM you\'ve requested. Missing an item (like the invoice) does not stop you from submitting - the form marks it as unavailable rather than requiring it.',
  });

  sections.push({
    key: 'after_submission',
    title: 'What happens after you submit',
    body: "CEIR issues a Request ID immediately - record it below so you can track status and use it later if you need to unblock the device. Blocking typically takes effect within about a day; the record's status field is only ever set by you, from what the CEIR portal actually tells you - RecoverAI never marks a submission as blocked on its own.",
  });

  sections.push({
    key: 'unblocking_after_recovery',
    title: 'If you get the device back',
    body: 'A blocked IMEI can be unblocked once you have the device in hand again - CEIR has a legitimate unblock-request workflow for exactly this. Go back to the same CEIR portal, use your original Request ID, and follow the unblock request process there; once it is confirmed, update the status below to Unblocked. Do not sell or hand off a device while its IMEI is still blocked.',
  });

  if (input.incidentType === 'LOST') {
    sections.push({
      key: 'lost_not_stolen_note',
      title: "If you're not sure this was theft",
      body: "CEIR blocking works the same way whether the device was lost or stolen - you don't need to assert theft to use it. Describe what actually happened on the CEIR form and in your police complaint; overstating what you know can create problems later if the device turns up.",
    });
  }

  return sections;
}
