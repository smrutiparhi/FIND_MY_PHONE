import { useEffect, useState, type ReactElement } from 'react';

interface PoliceReportDraftViewProps {
  draftText: string;
  isSimulated: boolean;
  submitting: boolean;
  exportFileName: string;
  onSave: (draftText: string) => Promise<void>;
}

function downloadTextFile(filename: string, text: string): void {
  const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

/** Preview / Edit / Save / Export, verbatim from the master spec's Part 13 list. */
export function PoliceReportDraftView({ draftText, isSimulated, submitting, exportFileName, onSave }: PoliceReportDraftViewProps): ReactElement {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(draftText);

  useEffect(() => {
    setDraft(draftText);
    setEditing(false);
  }, [draftText]);

  async function handleSave(): Promise<void> {
    await onSave(draft);
    setEditing(false);
  }

  return (
    <div className="glass-panel p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-slate-300">Complaint draft</h2>
        {isSimulated ? (
          <span className="rounded-full border border-amber-900 bg-amber-950 px-2 py-0.5 text-[10px] font-semibold text-amber-300">
            DEMO AI PROVIDER
          </span>
        ) : null}
      </div>

      {editing ? (
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          rows={16}
          maxLength={10000}
          className="mt-3 w-full rounded-md input-field px-3 py-2 font-mono text-xs text-white"
        />
      ) : (
        <pre className="mt-3 max-h-[28rem] overflow-y-auto whitespace-pre-wrap glass-panel-inset rounded-2xl p-3 font-mono text-xs text-slate-200">
          {draftText}
        </pre>
      )}

      <div className="mt-3 flex flex-wrap gap-2">
        {editing ? (
          <>
            <button
              type="button"
              disabled={submitting}
              onClick={() => void handleSave()}
              className="rounded-md bg-gradient-to-r from-cyan-500 to-fuchsia-500 px-3 py-1.5 text-xs font-semibold text-white hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Save
            </button>
            <button
              type="button"
              onClick={() => {
                setDraft(draftText);
                setEditing(false);
              }}
              className="rounded-md border border-white/15 px-3 py-1.5 text-xs font-medium text-slate-200 hover:bg-white/10"
            >
              Cancel
            </button>
          </>
        ) : (
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="rounded-md border border-white/15 px-3 py-1.5 text-xs font-medium text-slate-200 hover:bg-white/10"
          >
            Edit
          </button>
        )}
        <button
          type="button"
          onClick={() => downloadTextFile(exportFileName, draftText)}
          className="rounded-md border border-white/15 px-3 py-1.5 text-xs font-medium text-slate-200 hover:bg-white/10"
        >
          Export
        </button>
      </div>
    </div>
  );
}
