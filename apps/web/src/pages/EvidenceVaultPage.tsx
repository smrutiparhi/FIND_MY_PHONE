import { useCallback, useEffect, useState, type ReactElement } from 'react';
import { Link, useParams } from 'react-router-dom';
import type { Evidence, EvidenceAccessResult, EvidenceCategory } from '@recoverai/shared';
import { ApiClientError, apiDelete, apiGet, apiUpload } from '../lib/apiClient';
import { UploadEvidenceForm } from '../components/evidence/UploadEvidenceForm';
import { EvidenceTextViewer } from '../components/evidence/EvidenceTextViewer';
import { EvidenceCard, ErrorState } from '@recoverai/ui';

function describeError(err: unknown): string {
  if (err instanceof ApiClientError) return err.message;
  if (err instanceof Error) return err.message;
  return 'Something went wrong.';
}

type LoadState = { status: 'loading' } | { status: 'error'; message: string } | { status: 'success'; items: Evidence[] };
type ViewerState = { fileName: string; text: string } | null;

export function EvidenceVaultPage(): ReactElement {
  const { caseId } = useParams<{ caseId: string }>();
  const [state, setState] = useState<LoadState>({ status: 'loading' });
  const [submitting, setSubmitting] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [viewer, setViewer] = useState<ViewerState>(null);

  const load = useCallback(() => {
    if (!caseId) return;
    setState({ status: 'loading' });
    apiGet<Evidence[]>(`/api/recovery-cases/${caseId}/evidence`)
      .then((items) => setState({ status: 'success', items }))
      .catch((err: unknown) => setState({ status: 'error', message: describeError(err) }));
  }, [caseId]);

  useEffect(() => {
    load();
  }, [load]);

  async function handleUpload(input: { category: EvidenceCategory; description: string; file: File }): Promise<void> {
    if (!caseId) return;
    setSubmitting(true);
    setActionError(null);
    try {
      const formData = new FormData();
      formData.append('category', input.category);
      if (input.description) formData.append('description', input.description);
      formData.append('file', input.file);
      const created = await apiUpload<Evidence>(`/api/recovery-cases/${caseId}/evidence`, formData);
      setState((prev) => (prev.status === 'success' ? { ...prev, items: [created, ...prev.items] } : prev));
    } catch (err) {
      setActionError(describeError(err));
    } finally {
      setSubmitting(false);
    }
  }

  async function handleView(evidence: Evidence): Promise<void> {
    if (!caseId) return;
    setActionError(null);
    try {
      const result = await apiGet<EvidenceAccessResult>(`/api/recovery-cases/${caseId}/evidence/${evidence.id}/access`);
      if (result.kind === 'inline_text') {
        setViewer({ fileName: evidence.originalFileName, text: result.text });
      } else {
        window.open(result.url, '_blank', 'noopener,noreferrer');
      }
    } catch (err) {
      setActionError(describeError(err));
    }
  }

  async function handleDelete(evidence: Evidence): Promise<void> {
    if (!caseId) return;
    setSubmitting(true);
    setActionError(null);
    try {
      await apiDelete(`/api/recovery-cases/${caseId}/evidence/${evidence.id}`);
      setState((prev) => (prev.status === 'success' ? { ...prev, items: prev.items.filter((e) => e.id !== evidence.id) } : prev));
    } catch (err) {
      setActionError(describeError(err));
    } finally {
      setSubmitting(false);
    }
  }

  if (state.status === 'loading') {
    return <div role="status" className="text-sm text-slate-400">Loading Evidence Vault...</div>;
  }

  if (state.status === 'error') {
    return (
      <ErrorState title="Couldn't load the Evidence Vault." message={state.message} onRetry={load} />
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <Link to={`/recovery-cases/${caseId}`} className="text-xs text-slate-500 hover:text-slate-300">
          &larr; Back to case
        </Link>
        <h1 className="mt-2 text-2xl font-semibold text-white">Evidence Vault</h1>
        <p className="mt-1 text-sm text-slate-400">
          Store invoices, photos, and documents privately with this case - never shared through a public link. Files
          are only ever handed back to you as a short-lived, signed download.
        </p>
      </div>

      {actionError ? <p className="text-sm text-rose-400">{actionError}</p> : null}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="glass-panel p-5">
          <h2 className="text-sm font-semibold text-slate-300">Stored evidence ({state.items.length})</h2>
          {state.items.length === 0 ? (
            <p className="mt-2 text-sm text-slate-500">Nothing uploaded yet.</p>
          ) : (
            <ul className="mt-3 space-y-2">
              {state.items.map((item) => (
                <EvidenceCard key={item.id} evidence={item} submitting={submitting} onView={handleView} onDelete={handleDelete} />
              ))}
            </ul>
          )}
        </div>

        <UploadEvidenceForm submitting={submitting} onSubmit={handleUpload} />
      </div>

      {viewer ? <EvidenceTextViewer fileName={viewer.fileName} text={viewer.text} onClose={() => setViewer(null)} /> : null}
    </div>
  );
}
