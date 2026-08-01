import { useState, type FormEvent, type ReactElement } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AuthLayout } from '../../components/auth/AuthLayout';
import { FormMessage } from '../../components/auth/FormMessage';
import { FormField, Button } from '@recoverai/ui';
import { useAuth } from '../../hooks/useAuth';
import { supabase } from '../../lib/supabaseClient';

const MIN_PASSWORD_LENGTH = 8;

/**
 * Landing page for the link in the password-reset email. supabase-js
 * detects the recovery token in the URL automatically on load and
 * establishes a temporary session (this is what useAuth().session reflects
 * here) - no manual token parsing needed.
 */
export function ResetPasswordPage(): ReactElement {
  const { session, loading } = useAuth();
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent): Promise<void> {
    event.preventDefault();
    setError(null);

    if (password.length < MIN_PASSWORD_LENGTH) {
      setError(`Password must be at least ${MIN_PASSWORD_LENGTH} characters.`);
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setSubmitting(true);
    const { error: updateError } = await supabase.auth.updateUser({ password });
    setSubmitting(false);

    if (updateError) {
      setError(updateError.message);
      return;
    }
    navigate('/dashboard', { replace: true });
  }

  if (loading) {
    return (
      <AuthLayout title="Reset your password">
        <p className="text-sm text-slate-400">Checking your reset link...</p>
      </AuthLayout>
    );
  }

  if (!session) {
    return (
      <AuthLayout
        title="Link expired"
        subtitle="This password reset link is invalid or has expired"
        footer={
          <Link to="/forgot-password" className="font-medium text-cyan-300 hover:text-cyan-300">
            Request a new link
          </Link>
        }
      >
        <FormMessage tone="error">
          Password reset links only work once and expire after a short time.
        </FormMessage>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout title="Choose a new password" subtitle="Enter and confirm your new password">
      <form onSubmit={handleSubmit} className="space-y-4" noValidate>
        {error ? <FormMessage tone="error">{error}</FormMessage> : null}
        <FormField
          id="password"
          label="New password"
          type="password"
          value={password}
          onChange={setPassword}
          autoComplete="new-password"
          minLength={MIN_PASSWORD_LENGTH}
          required
        />
        <FormField
          id="confirmPassword"
          label="Confirm new password"
          type="password"
          value={confirmPassword}
          onChange={setConfirmPassword}
          autoComplete="new-password"
          minLength={MIN_PASSWORD_LENGTH}
          required
        />
        <Button type="submit" variant="primary" className="w-full" disabled={submitting}>
          {submitting ? 'Saving...' : 'Save new password'}
        </Button>
      </form>
    </AuthLayout>
  );
}
