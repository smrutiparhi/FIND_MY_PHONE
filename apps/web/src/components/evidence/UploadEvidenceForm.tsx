import { useRef, useState, type ChangeEvent, type FormEvent, type ReactElement } from 'react';
import { EVIDENCE_ALLOWED_MIME_TYPES, EVIDENCE_CATEGORIES, EVIDENCE_MAX_FILE_SIZE_BYTES, type EvidenceCategory } from '@recoverai/shared';
import { evidenceCategoryLabel } from './evidenceCategoryLabels';

interface UploadEvidenceFormProps {
  submitting: boolean;
  onSubmit: (input: { category: EvidenceCategory; description: string; file: File }) => Promise<void>;
}

const MAX_SIZE_LABEL = `${Math.floor(EVIDENCE_MAX_FILE_SIZE_BYTES / (1024 * 1024))} MB`;

/** Client-side checks are a convenience, not the real defense - the server re-validates type and size on every upload regardless. */
export function UploadEvidenceForm({ submitting, onSubmit }: UploadEvidenceFormProps): ReactElement {
  const [category, setCategory] = useState<EvidenceCategory>('PURCHASE_INVOICE');
  const [description, setDescription] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [localError, setLocalError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function handleFileChange(e: ChangeEvent<HTMLInputElement>): void {
    const selected = e.target.files?.[0] ?? null;
    setLocalError(null);
    if (selected && !(EVIDENCE_ALLOWED_MIME_TYPES as readonly string[]).includes(selected.type)) {
      setFile(null);
      setLocalError('Unsupported file type. Allowed: JPEG, PNG, WEBP images or PDF.');
      return;
    }
    if (selected && selected.size > EVIDENCE_MAX_FILE_SIZE_BYTES) {
      setFile(null);
      setLocalError(`File is too large. Maximum size is ${MAX_SIZE_LABEL}.`);
      return;
    }
    setFile(selected);
  }

  async function handleSubmit(e: FormEvent): Promise<void> {
    e.preventDefault();
    if (!file) {
      setLocalError('Choose a file to upload.');
      return;
    }
    await onSubmit({ category, description: description.trim(), file });
    setDescription('');
    setFile(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  return (
    <form onSubmit={(e) => void handleSubmit(e)} className="space-y-3 rounded-lg border border-slate-800 bg-slate-900 p-5">
      <h2 className="text-sm font-semibold text-slate-300">Upload evidence</h2>

      <label className="block text-xs text-slate-400">
        Category
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value as EvidenceCategory)}
          className="mt-1 w-full rounded-md border border-slate-700 bg-slate-950 px-2.5 py-1.5 text-sm text-white"
        >
          {EVIDENCE_CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {evidenceCategoryLabel(c)}
            </option>
          ))}
        </select>
      </label>

      <label className="block text-xs text-slate-400">
        Description (optional)
        <input
          type="text"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          maxLength={500}
          placeholder="e.g. Invoice from the store where I bought the phone"
          className="mt-1 w-full rounded-md border border-slate-700 bg-slate-950 px-2.5 py-1.5 text-sm text-white placeholder:text-slate-600"
        />
      </label>

      <label className="block text-xs text-slate-400">
        File
        <input
          ref={fileInputRef}
          type="file"
          accept={EVIDENCE_ALLOWED_MIME_TYPES.join(',')}
          onChange={handleFileChange}
          className="mt-1 block w-full text-xs text-slate-300 file:mr-3 file:rounded-md file:border file:border-slate-700 file:bg-slate-800 file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-slate-200 hover:file:bg-slate-700"
        />
        <span className="mt-1 block text-[11px] text-slate-500">JPEG, PNG, WEBP, or PDF - up to {MAX_SIZE_LABEL}.</span>
      </label>

      {localError ? <p className="text-xs text-red-400">{localError}</p> : null}

      <button
        type="submit"
        disabled={submitting || !file}
        className="rounded-md border border-slate-700 px-3 py-1.5 text-xs font-medium text-slate-200 hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {submitting ? 'Uploading...' : 'Upload'}
      </button>
    </form>
  );
}
