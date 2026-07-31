import { useCallback, useEffect, useState, type ReactElement } from 'react';
import { Link, useParams } from 'react-router-dom';
import type {
  CreateFinancialProtectionItemInput,
  FinancialProtectionItemId,
  FinancialSecurityState,
  UserSettableFinancialProtectionStatus,
} from '@recoverai/shared';
import { ApiClientError, apiDelete, apiGet, apiPatch, apiPost } from '../lib/apiClient';
import { AddFinancialItemForm } from '../components/financialSecurity/AddFinancialItemForm';
import { FinancialItemRow } from '../components/financialSecurity/FinancialItemRow';

function describeError(err: unknown): string {
  if (err instanceof ApiClientError) return err.message;
  if (err instanceof Error) return err.message;
  return 'Something went wrong.';
}

type LoadState = { status: 'loading' } | { status: 'error'; message: string } | { status: 'success'; state: FinancialSecurityState };

export function FinancialSecurityPage(): ReactElement {
  const { caseId } = useParams<{ caseId: string }>();
  const [state, setState] = useState<LoadState>({ status: 'loading' });
  const [submitting, setSubmitting] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const load = useCallback(() => {
    if (!caseId) return;
    setState({ status: 'loading' });
    apiGet<FinancialSecurityState>(`/api/recovery-cases/${caseId}/financial-security`)
      .then((data) => setState({ status: 'success', state: data }))
      .catch((err: unknown) => setState({ status: 'error', message: describeError(err) }));
  }, [caseId]);

  useEffect(() => {
    load();
  }, [load]);

  async function handleAddItem(input: CreateFinancialProtectionItemInput): Promise<void> {
    if (!caseId) return;
    setSubmitting(true);
    setActionError(null);
    try {
      const data = await apiPost<FinancialSecurityState>(`/api/recovery-cases/${caseId}/financial-security/items`, input);
      setState({ status: 'success', state: data });
    } catch (err) {
      setActionError(describeError(err));
    } finally {
      setSubmitting(false);
    }
  }

  async function handleChangeItemStatus(itemId: FinancialProtectionItemId, status: UserSettableFinancialProtectionStatus): Promise<void> {
    if (!caseId) return;
    setSubmitting(true);
    setActionError(null);
    try {
      const data = await apiPatch<FinancialSecurityState>(`/api/recovery-cases/${caseId}/financial-security/items/${itemId}`, { status });
      setState({ status: 'success', state: data });
    } catch (err) {
      setActionError(describeError(err));
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDeleteItem(itemId: FinancialProtectionItemId): Promise<void> {
    if (!caseId) return;
    setSubmitting(true);
    setActionError(null);
    try {
      const data = await apiDelete<FinancialSecurityState>(`/api/recovery-cases/${caseId}/financial-security/items/${itemId}`);
      setState({ status: 'success', state: data });
    } catch (err) {
      setActionError(describeError(err));
    } finally {
      setSubmitting(false);
    }
  }

  if (state.status === 'loading') {
    return <div className="text-sm text-slate-400">Loading financial security...</div>;
  }

  if (state.status === 'error') {
    return (
      <div className="rounded-lg border border-red-900 bg-red-950 p-5 text-sm text-red-300">
        <p className="font-medium">Couldn&apos;t load the Financial Security Center.</p>
        <p className="mt-1 text-red-400">{state.message}</p>
        <button
          type="button"
          onClick={load}
          className="mt-3 rounded-md border border-red-800 px-3 py-1.5 text-sm font-medium text-red-200 hover:bg-red-900"
        >
          Try again
        </button>
      </div>
    );
  }

  const { items, categoryGuides, warnings, recoveryCase } = state.state;
  const guideByCategory = new Map(categoryGuides.map((g) => [g.category, g]));

  return (
    <div className="space-y-6">
      <div>
        <Link to={`/recovery-cases/${recoveryCase.id}`} className="text-xs text-slate-500 hover:text-slate-300">
          &larr; Back to case
        </Link>
        <h1 className="mt-2 text-2xl font-semibold text-white">Financial security</h1>
        <p className="mt-1 text-sm text-slate-400">
          We&apos;ll never ask for a PIN, password, CVV, full card number, or OTP - only what apps and accounts are
          on the device and whether you&apos;ve secured them.
        </p>
      </div>

      {warnings.length > 0 ? (
        <div className="space-y-1 rounded-md border border-red-900 bg-red-950/60 p-4">
          {warnings.map((warning) => (
            <p key={warning} className="text-sm text-red-300">
              {warning}
            </p>
          ))}
        </div>
      ) : null}

      <p className="text-xs text-slate-500">
        A locked screen slows someone down - it doesn&apos;t protect your accounts. Confirm each one directly with
        its provider.
      </p>

      {actionError ? <p className="text-sm text-red-400">{actionError}</p> : null}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="rounded-lg border border-slate-800 bg-slate-900 p-5">
          <h2 className="text-sm font-semibold text-slate-300">Tracked items</h2>
          {items.length === 0 ? (
            <p className="mt-2 text-sm text-slate-500">Nothing tracked yet - add anything the device had access to below.</p>
          ) : (
            <ul className="mt-3 space-y-2">
              {items.map((item) => {
                const guide = guideByCategory.get(item.category);
                if (!guide) return null;
                return (
                  <FinancialItemRow
                    key={item.id}
                    item={item}
                    guide={guide}
                    submitting={submitting}
                    onChangeStatus={(status) => handleChangeItemStatus(item.id, status)}
                    onDelete={() => handleDeleteItem(item.id)}
                  />
                );
              })}
            </ul>
          )}
        </div>

        <AddFinancialItemForm categoryGuides={categoryGuides} submitting={submitting} onSubmit={handleAddItem} />
      </div>
    </div>
  );
}
