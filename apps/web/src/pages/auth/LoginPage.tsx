import { useState, type FormEvent, type ReactElement } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { AuthLayout } from '../../components/auth/AuthLayout';
import { FormField } from '../../components/auth/FormField';
import { FormMessage } from '../../components/auth/FormMessage';
import { AuthSubmitButton } from '../../components/auth/AuthSubmitButton';
import { useAuth } from '../../hooks/useAuth';
import { supabase } from '../../lib/supabaseClient';

export function LoginPage(): ReactElement {
  const { session, loading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!loading && session) {
    const redirectTo = (location.state as { from?: string } | null)?.from ?? '/';
    return <Navigate to={redirectTo} replace />;
  }

  async function handleSubmit(event: FormEvent): Promise<void> {
    event.preventDefault();
    setSubmitting(true);
    setError(null);

    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });

    setSubmitting(false);
    if (signInError) {
      // Deliberately generic - never reveal whether the email or the password was wrong.
      setError('Incorrect email or password.');
      return;
    }
    navigate('/', { replace: true });
  }

  return (
    <AuthLayout
      title="Sign in"
      subtitle="Access your recovery cases"
      footer={
        <>
          <p>
            No account?{' '}
            <Link to="/register" className="font-medium text-sky-400 hover:text-sky-300">
              Create one
            </Link>
          </p>
          <p className="mt-1">
            <Link to="/forgot-password" className="font-medium text-sky-400 hover:text-sky-300">
              Forgot your password?
            </Link>
          </p>
        </>
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
          autoComplete="current-password"
          required
        />
        <AuthSubmitButton disabled={submitting}>
          {submitting ? 'Signing in...' : 'Sign in'}
        </AuthSubmitButton>
      </form>
    </AuthLayout>
  );
}
