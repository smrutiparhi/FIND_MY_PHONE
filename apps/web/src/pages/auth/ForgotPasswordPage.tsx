import { useState, type FormEvent, type ReactElement } from 'react';
import { Link } from 'react-router-dom';
import { AuthLayout } from '../../components/auth/AuthLayout';
import { FormField } from '../../components/auth/FormField';
import { FormMessage } from '../../components/auth/FormMessage';
import { AuthSubmitButton } from '../../components/auth/AuthSubmitButton';
import { supabase } from '../../lib/supabaseClient';

const GENERIC_SENT_MESSAGE =
  "If an account exists for that email, we've sent a link to reset your password.";

export function ForgotPasswordPage(): ReactElement {
  const [email, setEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);

  async function handleSubmit(event: FormEvent): Promise<void> {
    event.preventDefault();
    setSubmitting(true);

    // Always show the same outcome regardless of whether this email has an
    // account or what Supabase's response was - never let this page reveal
    // which emails are registered (account-enumeration protection).
    await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });

    setSubmitting(false);
    setSent(true);
  }

  return (
    <AuthLayout
      title="Reset your password"
      subtitle="We'll email you a link to choose a new one"
      footer={
        <Link to="/login" className="font-medium text-sky-400 hover:text-sky-300">
          Back to sign in
        </Link>
      }
    >
      {sent ? (
        <FormMessage tone="success">{GENERIC_SENT_MESSAGE}</FormMessage>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
          <FormField
            id="email"
            label="Email"
            type="email"
            value={email}
            onChange={setEmail}
            autoComplete="email"
            required
          />
          <AuthSubmitButton disabled={submitting}>
            {submitting ? 'Sending...' : 'Send reset link'}
          </AuthSubmitButton>
        </form>
      )}
    </AuthLayout>
  );
}
