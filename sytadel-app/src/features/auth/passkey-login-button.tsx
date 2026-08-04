'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { startAuthentication } from '@simplewebauthn/browser';
import {
  passkeyLoginBeginAction,
  passkeyLoginFinishAction,
} from './passkey-actions';

type Props = {
  defaultEmail?: string;
  defaultTenantSlug?: string;
};

export function PasskeyLoginButton({
  defaultEmail = '',
  defaultTenantSlug = 'sentinel-labs',
}: Props) {
  const router = useRouter();
  const [email, setEmail] = useState(defaultEmail);
  const [tenantSlug, setTenantSlug] = useState(defaultTenantSlug);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSignIn() {
    setError(null);

    if (!email.trim() || !tenantSlug.trim()) {
      setError('Email and tenant are required');
      return;
    }

    setBusy(true);
    try {
      const options = await passkeyLoginBeginAction({
        email: email.trim(),
        tenantSlug: tenantSlug.trim(),
      });

      const response = await startAuthentication({ optionsJSON: options });

      const result = await passkeyLoginFinishAction({
        response,
        tenantSlug: tenantSlug.trim(),
      });

      if (!result.ok) {
        setError(result.error);
        return;
      }

      router.push('/app');
      router.refresh();
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Passkey sign-in failed';
      setError(message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="stack" style={{ gap: 12 }}>
      <div className="field">
        <label htmlFor="passkey-email">Email</label>
        <input
          className="input"
          id="passkey-email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          disabled={busy}
        />
      </div>
      <div className="field">
        <label htmlFor="passkey-tenant">Tenant slug</label>
        <input
          className="input"
          id="passkey-tenant"
          value={tenantSlug}
          onChange={(e) => setTenantSlug(e.target.value)}
          disabled={busy}
        />
      </div>
      <button
        type="button"
        className="button"
        onClick={onSignIn}
        disabled={busy}
      >
        {busy ? 'Waiting for passkey…' : 'Sign in with passkey'}
      </button>
      {error ? <div className="error-banner">{error}</div> : null}
    </div>
  );
}
