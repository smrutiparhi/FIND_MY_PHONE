import type { AiToolDefinition } from '../ai/AiProvider';

/**
 * The Recovery Agent's entire write surface - "the agent has access only to
 * ... approved application tools" per the master spec. Both tools require
 * `userConfirmed: true`; see toolHandlers.ts for the second, server-side
 * check this claim is held to (a naive model self-report isn't trusted
 * alone).
 */
export const RECOVERY_AGENT_TOOLS: AiToolDefinition[] = [
  {
    name: 'update_action_status',
    description:
      "Update one recovery action's status. Only call this after the user has explicitly confirmed the change in their most recent message.",
    parameters: {
      type: 'object',
      properties: {
        actionId: { type: 'string', description: 'The exact id of the action, copied from the case context above.' },
        newStatus: {
          type: 'string',
          description: 'The status to set.',
          enum: ['IN_PROGRESS', 'COMPLETED', 'SKIPPED'],
        },
        userConfirmed: {
          type: 'boolean',
          description: "True only if the user's most recent message clearly confirmed this exact change.",
        },
      },
      required: ['actionId', 'newStatus', 'userConfirmed'],
    },
  },
  {
    name: 'record_incident_details',
    description:
      'Record a correction or new fact about the incident that the user volunteered in conversation (e.g. they now have account access, a sensitive app they forgot to mention). Only include fields the user actually stated. Only call this after explicit confirmation.',
    parameters: {
      type: 'object',
      properties: {
        accountAccessStatus: { type: 'string', description: 'Updated Apple/Google account access.', enum: ['YES', 'NO', 'UNSURE'] },
        simAccessStatus: {
          type: 'string',
          description: 'Updated SIM/phone-number access.',
          enum: ['ANOTHER_DEVICE_HAS_ACCESS', 'LOST_WITH_PHONE', 'SIM_ALREADY_BLOCKED', 'UNSURE'],
        },
        screenLockEnabled: { type: 'string', description: 'Updated screen-lock status.', enum: ['YES', 'NO', 'UNSURE'] },
        deviceFindingAvailable: {
          type: 'string',
          description: 'Updated authorized device-finding availability.',
          enum: ['YES', 'NO', 'UNSURE'],
        },
        addSensitiveApps: {
          type: 'array',
          description: 'Sensitive app types the user newly mentioned. Additive only - never used to remove a previously-recorded app.',
          items: {
            type: 'string',
            enum: ['BANKING', 'UPI', 'EMAIL', 'SOCIAL_MEDIA', 'PASSWORD_MANAGER', 'AUTHENTICATOR', 'WORK_ACCOUNTS'],
          },
        },
        userConfirmed: {
          type: 'boolean',
          description: "True only if the user's most recent message clearly confirmed recording this.",
        },
      },
      required: ['userConfirmed'],
    },
  },
];
