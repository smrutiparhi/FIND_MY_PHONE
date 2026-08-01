import { useCallback, useEffect, useState, type ReactElement } from 'react';
import { Link, useParams } from 'react-router-dom';
import type { Device, LocationObservation, RecoveryCase, RecoveryCaseId, RecoveryPlan, TimelineEvent } from '@recoverai/shared';
import { ApiClientError, apiGet, apiPatch } from '../lib/apiClient';
import { EmergencyBanner, ErrorState, buttonClasses } from '@recoverai/ui';
import { CaseSummaryHeader } from '../components/recoveryCase/CaseSummaryHeader';
import { RecoveryProgressCard } from '../components/recoveryCase/RecoveryProgressCard';
import { DashboardSectionCard } from '../components/recoveryCase/DashboardSectionCard';
import { RecoveryPlanPanel } from '../components/recoveryCase/RecoveryPlanPanel';
import { AgentChatPanel } from '../components/recoveryAgent/AgentChatPanel';
import { DASHBOARD_SECTIONS } from '../components/recoveryCase/dashboardSections';

function describeError(err: unknown): string {
  if (err instanceof ApiClientError) return err.message;
  if (err instanceof Error) return err.message;
  return 'Something went wrong.';
}

interface DashboardData {
  recoveryCase: RecoveryCase;
  device: Device;
  recoveryPlan: RecoveryPlan;
  latestLocation: LocationObservation | null;
  latestTimelineEvents: TimelineEvent[];
}

type LoadState = { status: 'loading' } | { status: 'error'; message: string } | { status: 'success'; data: DashboardData };

/**
 * "Build the main case page" (master spec, Part 17) - top summary, a
 * Recovery Progress checklist with the engine's current recommended action
 * as the largest CTA, one card per main section, the full detailed plan,
 * and the AI Recovery Agent as an assistant panel.
 */
export function RecoveryCaseDetailPage(): ReactElement {
  const { caseId } = useParams<{ caseId: string }>();
  const [state, setState] = useState<LoadState>({ status: 'loading' });
  const [submitting, setSubmitting] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const load = useCallback(() => {
    if (!caseId) return;
    setState({ status: 'loading' });
    Promise.all([
      apiGet<RecoveryCase>(`/api/recovery-cases/${caseId}`),
      apiGet<Device[]>('/api/devices'),
      apiGet<RecoveryPlan>(`/api/recovery-cases/${caseId}/recovery-plan`),
      apiGet<LocationObservation[]>(`/api/recovery-cases/${caseId}/locations`),
      apiGet<TimelineEvent[]>(`/api/recovery-cases/${caseId}/timeline?order=desc`),
    ])
      .then(([recoveryCase, devices, recoveryPlan, locations, timelineEvents]) => {
        const device = devices.find((d) => d.id === recoveryCase.deviceId);
        if (!device) {
          setState({ status: 'error', message: "Could not load this case's device." });
          return;
        }
        setState({
          status: 'success',
          data: { recoveryCase, device, recoveryPlan, latestLocation: locations[0] ?? null, latestTimelineEvents: timelineEvents.slice(0, 3) },
        });
      })
      .catch((err: unknown) => setState({ status: 'error', message: describeError(err) }));
  }, [caseId]);

  useEffect(() => {
    load();
  }, [load]);

  const handleCaseUpdated = (recoveryCase: RecoveryCase, recoveryPlan: RecoveryPlan): void => {
    setState((prev) => (prev.status === 'success' ? { ...prev, data: { ...prev.data, recoveryCase, recoveryPlan } } : prev));
  };

  async function handleMarkActionDone(actionId: string): Promise<void> {
    if (!caseId) return;
    setSubmitting(true);
    setActionError(null);
    try {
      await apiPatch(`/api/recovery-cases/${caseId}/actions/${actionId}`, { status: 'COMPLETED' });
      load();
    } catch (err) {
      setActionError(describeError(err));
    } finally {
      setSubmitting(false);
    }
  }

  if (state.status === 'loading') {
    return (
      <div role="status" className="text-sm text-slate-400">
        Loading case...
      </div>
    );
  }

  if (state.status === 'error') {
    return <ErrorState title="Couldn't load this case." message={state.message} onRetry={load} />;
  }

  const { recoveryCase, device, recoveryPlan, latestLocation, latestTimelineEvents } = state.data;
  const caseIdTyped = recoveryCase.id as RecoveryCaseId;
  const isEmergency = recoveryCase.riskLevel === 'CRITICAL' || recoveryCase.riskLevel === 'HIGH';
  const actionByType = new Map(recoveryPlan.orderedActions.map((a) => [a.type, a]));

  return (
    <div className="space-y-6">
      {isEmergency ? (
        <EmergencyBanner
          title="This case is high risk"
          description="Open the focused emergency view for just the next critical step."
          cta={
            <Link to={`/recovery-cases/${recoveryCase.id}/emergency`} className={buttonClasses('danger', 'sm')}>
              Open emergency view &rarr;
            </Link>
          }
        />
      ) : null}

      <CaseSummaryHeader recoveryCase={recoveryCase} device={device} latestLocation={latestLocation} />

      {recoveryCase.status !== 'CLOSED' ? (
        <Link to={`/recovery-cases/${caseIdTyped}/recovered`} className="glass-panel-success glass-panel-hover flex items-center justify-between gap-3 px-4 py-3 text-sm font-semibold text-emerald-200">
          <span>I found my phone</span>
          <span aria-hidden="true">&rarr;</span>
        </Link>
      ) : null}

      {actionError ? <p className="text-sm text-rose-400">{actionError}</p> : null}

      <RecoveryProgressCard caseId={caseIdTyped} plan={recoveryPlan} submitting={submitting} onMarkActionDone={handleMarkActionDone} />

      <div>
        <h2 className="text-sm font-semibold text-slate-300">Sections</h2>
        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {DASHBOARD_SECTIONS.map((section) => {
            const action = actionByType.get(section.actionType);
            return (
              <DashboardSectionCard
                key={section.key}
                label={section.label}
                action={action}
                route={section.route ? section.route(caseIdTyped) : null}
                isCurrent={recoveryPlan.currentRecommendedAction?.type === section.actionType}
              />
            );
          })}

          <div className="glass-panel p-4">
            <h3 className="text-sm font-semibold text-slate-200">Timeline</h3>
            {latestTimelineEvents.length === 0 ? (
              <p className="mt-1.5 text-xs text-slate-500">Nothing recorded yet.</p>
            ) : (
              <ul className="mt-1.5 space-y-1">
                {latestTimelineEvents.map((event) => (
                  <li key={event.id} className="truncate text-xs text-slate-400">
                    {event.title}
                  </li>
                ))}
              </ul>
            )}
            <div className="mt-3">
              <Link to={`/recovery-cases/${caseIdTyped}/timeline`} className="text-xs font-medium text-cyan-300 hover:underline">
                View &rarr;
              </Link>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <RecoveryPlanPanel plan={recoveryPlan} />
        <AgentChatPanel caseId={caseIdTyped} onCaseUpdated={handleCaseUpdated} />
      </div>
    </div>
  );
}
