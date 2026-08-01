import { useState, type FormEvent, type ReactElement } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { AuthLayout } from '../../components/auth/AuthLayout';
import { FormMessage } from '../../components/auth/FormMessage';
import { FormField, Button } from '@recoverai/ui';
import { useAuth } from '../../hooks/useAuth';
import { supabase } from '../../lib/supabaseClient';

const MIN_PASSWORD_LENGTH = 8;

export function RegisterPage(): ReactElement {
  const { session, loading } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [checkEmailMessage, setCheckEmailMessage] = useState<string | null>(null);

  if (!loading && session) {
    return <Navigate to="/dashboard" replace />;
  }

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
    const { data, error: signUpError } = await supabase.auth.signUp({ email, password });
    setSubmitting(false);

    if (signUpError) {
      setError(signUpError.message);
      return;
    }

    if (data.session) {
      // Email confirmation is disabled on this project - signed in immediately.
      navigate('/dashboard', { replace: true });
      return;
    }

    // Email confirmation is required - Supabase already sent the verification email.
    setCheckEmailMessage(
      `We've sent a confirmation link to ${email}. Verify your email, then sign in.`,
    );
  }

  if (checkEmailMessage) {
    return (
      <AuthLayout title="Check your email" subtitle="One more step">
        <FormMessage tone="success">{checkEmailMessage}</FormMessage>
        <Link
          to="/login"
          className="mt-4 block text-center text-sm font-medium text-cyan-300 hover:text-cyan-300"
        >
          Back to sign in
        </Link>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      title="Create your account"
      subtitle="Get set up to report and track a lost or stolen phone"
      footer={
        <p>
          Already have an account?{' '}
          <Link to="/login" className="font-medium text-cyan-300 hover:text-cyan-300">
            Sign in
          </Link>
        </p>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4" noValidate>
        {error ? <FormMessage tone="error">{error}</FormMessage> : null}
        <FormField
          id="email"
          label="Email"
          type="email"
          value={email}
          onChange={setEmail}
          autoComplete="email"
          required
        />
        <FormField
          id="password"
          label="Password"
          type="password"
          value={password}
          onChange={setPassword}
          autoComplete="new-password"
          minLength={MIN_PASSWORD_LENGTH}
          required
        />
        <FormField
          id="confirmPassword"
          label="Confirm password"
          type="password"
          value={confirmPassword}
          onChange={setConfirmPassword}
          autoComplete="new-password"
          minLength={MIN_PASSWORD_LENGTH}
          required
        />
        <Button type="submit" variant="primary" className="w-full" disabled={submitting}>
          {submitting ? 'Creating account...' : 'Create account'}
        </Button>
      </form>
    </AuthLayout>
  );
}
