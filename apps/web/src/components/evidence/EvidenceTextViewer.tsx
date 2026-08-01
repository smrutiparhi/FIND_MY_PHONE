import type { ReactElement } from 'react';

interface EvidenceTextViewerProps {
  fileName: string;
  text: string;
  onClose: () => void;
}

/** Used for the Evidence rows Parts 13/14 create that reference generated text (an approved police complaint, a CEIR record) rather than a real uploaded file - see EvidenceAccessResult's `inline_text` kind. */
export function EvidenceTextViewer({ fileName, text, onClose }: EvidenceTextViewerProps): ReactElement {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div className="max-h-[80vh] w-full max-w-2xl overflow-hidden rounded-lg border border-slate-700 bg-slate-900 shadow-xl">
        <div className="flex items-center justify-between border-b border-slate-800 px-4 py-3">
          <h3 className="text-sm font-semibold text-white">{fileName}</h3>
          <button type="button" onClick={onClose} className="text-xs text-slate-400 hover:text-slate-200">
            Close
          </button>
        </div>
        <pre className="max-h-[65vh] overflow-auto whitespace-pre-wrap p-4 text-xs text-slate-300">{text}</pre>
      </div>
    </div>
  );
}
