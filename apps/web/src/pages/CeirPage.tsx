import { useCallback, useEffect, useState, type ReactElement } from 'react';
import { Link, useParams } from 'react-router-dom';
import type { CeirChecklistItem, CeirState, UserSettableCeirStatus } from '@recoverai/shared';
import { ApiClientError, apiGet, apiPatch } from '../lib/apiClient';
import { CeirStatusBadge } from '../components/ceir/CeirStatusBadge';
import { CeirStatusControl } from '../components/ceir/CeirStatusControl';
import { CeirChecklist } from '../components/ceir/CeirChecklist';
import { CeirDeviceIdentifiersCard } from '../components/ceir/CeirDeviceIdentifiersCard';
import { CeirRequestDetailsForm } from '../components/ceir/CeirRequestDetailsForm';
import { CeirOfficialLinksCard } from '../components/ceir/CeirOfficialLinksCard';
import { CeirGuidanceSections } from '../components/ceir/CeirGuidanceSections';
import { ErrorState } from '@recoverai/ui';

function describeError(err: unknown): string {
  if (err instanceof ApiClientError) return err.message;
  if (err instanceof Error) return err.message;
  return 'Something went wrong.';
}

type LoadState = { status: 'loading' } | { status: 'error'; message: string } | { status: 'success'; state: CeirState };

export function CeirPage(): ReactElement {
  const { caseId } = useParams<{ caseId: string }>();
  const [state, setState] = useState<LoadState>({ status: 'loading' });
  const [submitting, setSubmitting] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const load = useCallback(() => {
    if (!caseId) return;
    setState({ status: 'loading' });
    apiGet<CeirState>(`/api/recovery-cases/${caseId}/ceir`)
      .then((data) => setState({ status: 'success', state: data }))
      .catch((err: unknown) => setState({ status: 'error', message: describeError(err) }));
  }, [caseId]);

  useEffect(() => {
    load();
  }, [load]);

  async function patch(body: Record<string, unknown>): Promise<void> {
    if (!caseId) return;
    setSubmitting(true);
    setActionError(null);
    try {
      const data = await apiPatch<CeirState>(`/api/recovery-cases/${caseId}/ceir`, body);
      setState({ status: 'success', state: data });
    } catch (err) {
      setActionError(describeError(err));
    } finally {
      setSubmitting(false);
    }
  }

  async function handleChangeStatus(status: UserSettableCeirStatus): Promise<void> {
    await patch({ status });
  }

  async function handleToggleChecklistItem(item: CeirChecklistItem, completed: boolean): Promise<void> {
    if (state.status !== 'success') return;
    const current = state.state.record.checklistCompletedItems;
    const next = completed ? Array.from(new Set([...current, item])) : current.filter((i) => i !== item);
    await patch({ checklistCompletedItems: next });
  }

  async function handleSaveDetails(input: { ceirRequestId: string | null; submissionDate: string | null; notes: string | null }): Promise<void> {
    await patch(input);
  }

  if (state.status === 'loading') {
    return <div role="status" className="text-sm text-slate-400">Loading CEIR Assistant...</div>;
  }

  if (state.status === 'error') {
    return (
      <ErrorState title="Couldn't load the CEIR Assistant." message={state.message} onRetry={load} />
    );
  }

  const { record, deviceIdentifiers, checklistHints, guidanceSections, officialLinks, recoveryCase } = state.state;

  return (
    <div className="space-y-6">
      <div>
        <Link to={`/recovery-cases/${recoveryCase.id}`} className="text-xs text-slate-500 hover:text-slate-300">
          &larr; Back to case
        </Link>
        <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-2xl font-semibold text-white">CEIR / IMEI blocking</h1>
          <CeirStatusBadge status={record.status} />
        </div>
      </div>

      {record.status === 'UNBLOCKED' ? (
        <div className="glass-panel-success p-4 text-sm text-emerald-300">
          Your IMEI has been unblocked. The recovery plan has been updated.
        </div>
      ) : (
        <CeirStatusControl status={record.status} submitting={submitting} onChangeStatus={handleChangeStatus} />
      )}

      {actionError ? <p className="text-sm text-rose-400">{actionError}</p> : null}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="space-y-6">
          <CeirDeviceIdentifiersCard identifiers={deviceIdentifiers} />
          <CeirChecklist
            hints={checklistHints}
            completedItems={record.checklistCompletedItems}
            submitting={submitting}
            onToggle={handleToggleChecklistItem}
          />
          <CeirRequestDetailsForm record={record} submitting={submitting} onSave={handleSaveDetails} />
          <CeirOfficialLinksCard links={officialLinks} />
        </div>
        <CeirGuidanceSections sections={guidanceSections} />
      </div>
    </div>
  );
}
