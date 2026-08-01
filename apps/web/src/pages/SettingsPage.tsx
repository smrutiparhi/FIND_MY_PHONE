import { useState, type ReactElement } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { ApiClientError, apiDelete } from '../lib/apiClient';
import { Button, ConfirmDialog } from '@recoverai/ui';

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
        <h1 className="font-display text-2xl font-semibold text-white">Settings</h1>
        <p className="text-sm text-slate-400">Manage your account.</p>
      </div>

      <section className="glass-panel p-5">
        <h2 className="text-sm font-semibold text-slate-200">Account</h2>
        <p className="mt-2 text-sm text-slate-400">Signed in as {user?.email}</p>
        <Button variant="secondary" size="sm" className="mt-4" onClick={() => void signOut()}>
          Sign out
        </Button>
      </section>

      <section className="glass-panel-danger p-5">
        <h2 className="text-sm font-semibold text-rose-300">Delete account</h2>
        <p className="mt-2 text-sm text-rose-400">
          Permanently deletes your account and every recovery case, device, and piece of evidence associated with
          it. This cannot be undone.
        </p>

        {error ? <p className="mt-3 text-sm text-rose-300">{error}</p> : null}

        <Button variant="danger" size="sm" className="mt-4" onClick={() => setConfirmingDelete(true)}>
          Delete my account
        </Button>
      </section>

      <ConfirmDialog
        open={confirmingDelete}
        title="Delete your account?"
        description="This permanently deletes your account and every recovery case, device, and piece of evidence associated with it. This cannot be undone."
        confirmLabel={deleting ? 'Deleting...' : 'Yes, permanently delete'}
        tone="danger"
        submitting={deleting}
        onConfirm={() => void handleDeleteAccount()}
        onCancel={() => setConfirmingDelete(false)}
      />
    </div>
  );
}
