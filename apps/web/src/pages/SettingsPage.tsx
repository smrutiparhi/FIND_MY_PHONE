import { useState, type ReactElement } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { ApiClientError, apiDelete } from '../lib/apiClient';

export function SettingsPage(): ReactElement {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleDeleteAccount(): Promise<void> {
    setDeleting(true);
    setError(null);
    try {
      await apiDelete('/api/auth/account');
      await signOut();
      navigate('/login', { replace: true });
    } catch (err) {
      setDeleting(false);
      setError(err instanceof ApiClientError ? err.message : 'Could not delete your account. Please try again.');
    }
  }

  return (
    <div className="max-w-lg space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-white">Settings</h1>
        <p className="text-sm text-slate-400">Manage your account.</p>
      </div>

      <section className="rounded-lg border border-slate-800 bg-slate-900 p-5">
        <h2 className="text-sm font-semibold text-slate-200">Account</h2>
        <p className="mt-2 text-sm text-slate-400">Signed in as {user?.email}</p>
        <button
          type="button"
          onClick={() => void signOut()}
          className="mt-4 rounded-md border border-slate-700 px-3 py-1.5 text-sm font-medium text-slate-300 hover:bg-slate-800"
        >
          Sign out
        </button>
      </section>

      <section className="rounded-lg border border-red-900 bg-red-950/40 p-5">
        <h2 className="text-sm font-semibold text-red-300">Delete account</h2>
        <p className="mt-2 text-sm text-red-400">
          Permanently deletes your account and every recovery case, device, and piece of evidence associated with
          it. This cannot be undone.
        </p>

        {error ? <p className="mt-3 text-sm text-red-300">{error}</p> : null}

        {!confirmingDelete ? (
          <button
            type="button"
            onClick={() => setConfirmingDelete(true)}
            className="mt-4 rounded-md border border-red-800 px-3 py-1.5 text-sm font-medium text-red-200 hover:bg-red-900"
          >
            Delete my account
          </button>
        ) : (
          <div className="mt-4 space-y-2">
            <p className="text-sm font-medium text-red-200">Are you sure? This is permanent.</p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => void handleDeleteAccount()}
                disabled={deleting}
                className="rounded-md bg-red-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-red-500 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {deleting ? 'Deleting...' : 'Yes, permanently delete'}
              </button>
              <button
                type="button"
                onClick={() => setConfirmingDelete(false)}
                disabled={deleting}
                className="rounded-md border border-slate-700 px-3 py-1.5 text-sm font-medium text-slate-300 hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
