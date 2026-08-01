import { useState, type FormEvent, type ReactElement } from 'react';
import type { CeirRecord } from '@recoverai/shared';

interface CeirRequestDetailsFormProps {
  record: CeirRecord;
  submitting: boolean;
  onSave: (input: { ceirRequestId: string | null; submissionDate: string | null; notes: string | null }) => Promise<void>;
}

/** Purely user-entered - the id and date CEIR itself issued, never generated or guessed by RecoverAI. */
export function CeirRequestDetailsForm({ record, submitting, onSave }: CeirRequestDetailsFormProps): ReactElement {
  const [ceirRequestId, setCeirRequestId] = useState(record.ceirRequestId ?? '');
  const [submissionDate, setSubmissionDate] = useState(record.submissionDate ?? '');
  const [notes, setNotes] = useState(record.notes ?? '');

  async function handleSubmit(e: FormEvent): Promise<void> {
    e.preventDefault();
    await onSave({
      ceirRequestId: ceirRequestId.trim() === '' ? null : ceirRequestId.trim(),
      submissionDate: submissionDate.trim() === '' ? null : submissionDate.trim(),
      notes: notes.trim() === '' ? null : notes.trim(),
    });
  }

  return (
    <form onSubmit={(e) => void handleSubmit(e)} className="space-y-3 glass-panel p-5">
      <h2 className="text-sm font-semibold text-slate-300">CEIR request details</h2>
      <label className="block text-xs text-slate-400">
        CEIR Request ID
        <input
          type="text"
          value={ceirRequestId}
          onChange={(e) => setCeirRequestId(e.target.value)}
          placeholder="Issued by the CEIR portal after you submit"
          maxLength={100}
          className="mt-1 w-full rounded-md input-field px-2.5 py-1.5 text-sm text-white placeholder:text-slate-600"
        />
      </label>
      <label className="block text-xs text-slate-400">
        Submission date
        <input
          type="date"
          value={submissionDate}
          onChange={(e) => setSubmissionDate(e.target.value)}
          className="mt-1 w-full rounded-md input-field px-2.5 py-1.5 text-sm text-white"
        />
      </label>
      <label className="block text-xs text-slate-400">
        Notes
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          maxLength={1000}
          rows={3}
          placeholder="Anything else worth remembering about this request"
          className="mt-1 w-full rounded-md input-field px-2.5 py-1.5 text-sm text-white placeholder:text-slate-600"
        />
      </label>
      <button
        type="submit"
        disabled={submitting}
        className="rounded-md border border-white/15 px-3 py-1.5 text-xs font-medium text-slate-200 hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50"
      >
        Save
      </button>
    </form>
  );
}
