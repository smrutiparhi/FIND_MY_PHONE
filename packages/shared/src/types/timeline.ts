export const TIMELINE_ORDERS = ['asc', 'desc'] as const;
export type TimelineOrder = (typeof TIMELINE_ORDERS)[number];

export interface CreateTimelineNoteInput {
  title: string;
  description?: string | null;
}

export type UpdateTimelineNoteInput = CreateTimelineNoteInput;

/** Server-generated on each request - never cached client-side, since the underlying timeline can change between exports. */
export interface CaseSummaryExport {
  summary: string;
  generatedAt: string;
}
