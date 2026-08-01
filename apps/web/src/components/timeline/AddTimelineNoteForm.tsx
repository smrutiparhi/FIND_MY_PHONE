import { useState, type FormEvent, type ReactElement } from 'react';
import type { CreateTimelineNoteInput } from '@recoverai/shared';

interface AddTimelineNoteFormProps {
  submitting: boolean;
  onSubmit: (input: CreateTimelineNoteInput) => Promise<void>;
}

export function AddTimelineNoteForm({ submitting, onSubmit }: AddTimelineNoteFormProps): ReactElement {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');

  async function handleSubmit(e: FormEvent): Promise<void> {
    e.preventDefault();
    if (title.trim() === '') return;
    await onSubmit({ title: title.trim(), description: description.trim() === '' ? null : description.trim() });
    setTitle('');
    setDescription('');
  }

  return (
    <form onSubmit={(e) => void handleSubmit(e)} className="space-y-3 rounded-lg border border-slate-800 bg-slate-900 p-5">
      <h2 className="text-sm font-semibold text-slate-300">Add a note</h2>
      <label className="block text-xs text-slate-400">
        Title
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          maxLength={200}
          placeholder="e.g. Called the bank to flag the account"
          className="mt-1 w-full rounded-md border border-slate-700 bg-slate-950 px-2.5 py-1.5 text-sm text-white placeholder:text-slate-600"
        />
      </label>
      <label className="block text-xs text-slate-400">
        Details (optional)
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          maxLength={2000}
          rows={3}
          className="mt-1 w-full rounded-md border border-slate-700 bg-slate-950 px-2.5 py-1.5 text-sm text-white placeholder:text-slate-600"
        />
      </label>
      <button
        type="submit"
        disabled={submitting || title.trim() === ''}
        className="rounded-md border border-slate-700 px-3 py-1.5 text-xs font-medium text-slate-200 hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
      >
        Add note
      </button>
    </form>
  );
}
