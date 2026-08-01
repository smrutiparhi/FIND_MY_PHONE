import { useCallback, useEffect, useState, type ReactElement } from 'react';
import { Link, useParams } from 'react-router-dom';
import type {
  CreatePoliceReportInput,
  PoliceReport,
  PoliceReportId,
  PoliceReportState,
  RecoveryCase,
  User,
} from '@recoverai/shared';
import { ApiClientError, apiGet, apiPatch, apiPost } from '../lib/apiClient';
import { PoliceReportFactsForm } from '../components/policeReport/PoliceReportFactsForm';
import { PoliceReportDraftView } from '../components/policeReport/PoliceReportDraftView';
import { PoliceReportStatusBadge } from '../components/policeReport/PoliceReportStatusBadge';
import { PoliceReportApprovalActions } from '../components/policeReport/PoliceReportApprovalActions';
import { PoliceReportVersionHistory } from '../components/policeReport/PoliceReportVersionHistory';
import { ErrorState } from '@recoverai/ui';

function describeError(err: unknown): string {
  if (err instanceof ApiClientError) return err.message;
  if (err instanceof Error) return err.message;
  return 'Something went wrong.';
}

type LoadState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'empty'; recoveryCase: RecoveryCase; profile: User }
  | { status: 'success'; recoveryCase: RecoveryCase; report: PoliceReportState };

export function PoliceReportPage(): ReactElement {
  const { caseId } = useParams<{ caseId: string }>();
  const [state, setState] = useState<LoadState>({ status: 'loading' });
  const [submitting, setSubmitting] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [regenerating, setRegenerating] = useState(false);

  const load = useCallback(() => {
    if (!caseId) return;
    setState({ status: 'loading' });
    Promise.all([
      apiGet<RecoveryCase>(`/api/recovery-cases/${caseId}`),
      apiGet<PoliceReport[]>(`/api/recovery-cases/${caseId}/police-reports`),
      apiGet<User>('/api/auth/me'),
    ])
      .then(([recoveryCase, reports, profile]) => {
        const latest = reports[0];
        if (!latest) {
          setState({ status: 'empty', recoveryCase, profile });
          return;
        }
        apiGet<PoliceReportState>(`/api/recovery-cases/${caseId}/police-reports/${latest.id}`).then((report) =>
          setState({ status: 'success', recoveryCase, report }),
        );
      })
      .catch((err: unknown) => setState({ status: 'error', message: describeError(err) }));
  }, [caseId]);

  useEffect(() => {
    load();
  }, [load]);

  async function handleCreate(input: CreatePoliceReportInput): Promise<void> {
    if (!caseId) return;
    setSubmitting(true);
    setActionError(null);
    try {
      await apiPost(`/api/recovery-cases/${caseId}/police-reports`, input);
      load();
    } catch (err) {
      setActionError(describeError(err));
    } finally {
      setSubmitting(false);
    }
  }

  async function handleRegenerate(reportId: PoliceReportId, input: CreatePoliceReportInput): Promise<void> {
    if (!caseId) return;
    setSubmitting(true);
    setActionError(null);
    try {
      await apiPost(`/api/recovery-cases/${caseId}/police-reports/${reportId}/regenerate`, input);
      setRegenerating(false);
      load();
    } catch (err) {
      setActionError(describeError(err));
    } finally {
      setSubmitting(false);
    }
  }

  async function handleSaveDraft(reportId: PoliceReportId, draftText: string): Promise<void> {
    if (!caseId) return;
    setSubmitting(true);
    setActionError(null);
    try {
      await apiPatch(`/api/recovery-cases/${caseId}/police-reports/${reportId}/draft`, { draftText });
      load();
    } catch (err) {
      setActionError(describeError(err));
    } finally {
      setSubmitting(false);
    }
  }

  async function handleApprove(reportId: PoliceReportId): Promise<void> {
    if (!caseId) return;
    setSubmitting(true);
    setActionError(null);
    try {
      await apiPost(`/api/recovery-cases/${caseId}/police-reports/${reportId}/approve`, {});
      load();
    } catch (err) {
      setActionError(describeError(err));
    } finally {
      setSubmitting(false);
    }
  }

  async function handleMarkSubmitted(reportId: PoliceReportId, externalReferenceNumber: string | null): Promise<void> {
    if (!caseId) return;
    setSubmitting(true);
    setActionError(null);
    try {
      await apiPost(`/api/recovery-cases/${caseId}/police-reports/${reportId}/mark-submitted`, { externalReferenceNumber });
      load();
    } catch (err) {
      setActionError(describeError(err));
    } finally {
      setSubmitting(false);
    }
  }

  if (state.status === 'loading') {
    return <div role="status" className="text-sm text-slate-400">Loading police complaint assistant...</div>;
  }

  if (state.status === 'error') {
    return (
      <ErrorState title="Couldn't load the Police Complaint Assistant." message={state.message} onRetry={load} />
    );
  }

  const header = (recoveryCase: RecoveryCase): ReactElement => (
    <div>
      <Link to={`/recovery-cases/${recoveryCase.id}`} className="text-xs text-slate-500 hover:text-slate-300">
        &larr; Back to case
      </Link>
      <h1 className="mt-2 text-2xl font-semibold text-white">Police complaint assistant</h1>
      <p className="mt-1 text-sm text-slate-400">
        RecoverAI drafts a professional complaint from only the facts you and your case provide - it never invents
        an IMEI, address, or suspect, and never claims the complaint has been filed on your behalf.
      </p>
    </div>
  );

  if (state.status === 'empty') {
    return (
      <div className="space-y-6">
        {header(state.recoveryCase)}
        {actionError ? <p className="text-sm text-rose-400">{actionError}</p> : null}
        <PoliceReportFactsForm
          title="Tell us what happened"
          submitLabel="Generate draft complaint"
          submitting={submitting}
          initial={{
            ownerFullName: state.profile.fullName ?? '',
            ownerContact: state.profile.email,
            incidentDateTime: state.recoveryCase.occurredAt,
            lastKnownPlace: state.recoveryCase.lastSeenDescription,
            incidentDescription: '',
          }}
          onSubmit={handleCreate}
        />
      </div>
    );
  }

  const { recoveryCase, report } = state;

  return (
    <div className="space-y-6">
      {header(recoveryCase)}

      <div className="flex items-center gap-2">
        <PoliceReportStatusBadge status={report.report.status} />
        {report.report.externalReferenceNumber ? (
          <span className="text-xs text-slate-500">Reference: {report.report.externalReferenceNumber}</span>
        ) : null}
      </div>

      {actionError ? <p className="text-sm text-rose-400">{actionError}</p> : null}

      {regenerating ? (
        <PoliceReportFactsForm
          title="Update the facts and regenerate"
          submitLabel="Regenerate draft"
          submitting={submitting}
          initial={{
            ownerFullName: report.report.ownerFullName,
            ownerContact: report.report.ownerContact,
            incidentDateTime: report.report.incidentDateTime,
            lastKnownPlace: report.report.lastKnownPlace,
            incidentDescription: report.report.incidentDescription,
          }}
          onSubmit={(input) => handleRegenerate(report.report.id, input)}
        />
      ) : (
        <>
          <PoliceReportApprovalActions
            status={report.report.status}
            submitting={submitting}
            onRegenerate={() => setRegenerating(true)}
            onApprove={() => handleApprove(report.report.id)}
            onMarkSubmitted={(ref) => handleMarkSubmitted(report.report.id, ref)}
          />

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <PoliceReportDraftView
              draftText={report.report.draftText}
              isSimulated={report.isSimulated}
              submitting={submitting}
              exportFileName={`police-complaint-${recoveryCase.id}.txt`}
              onSave={(draftText) => handleSaveDraft(report.report.id, draftText)}
            />
            <PoliceReportVersionHistory versions={report.versions} />
          </div>
        </>
      )}
    </div>
  );
}
