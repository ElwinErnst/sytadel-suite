'use client';

import { useEffect, useState, useTransition } from 'react';
import { startRegistration } from '@simplewebauthn/browser';
import {
  deletePasskeyAction,
  listPasskeysAction,
  passkeyRegisterBeginAction,
  passkeyRegisterFinishAction,
  renamePasskeyAction,
} from './passkey-actions';
import type { PasskeySummary } from '@/lib/server/passkeys-client';

function formatDate(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString();
}

export function PasskeysPanel() {
  const [passkeys, setPasskeys] = useState<PasskeySummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [newName, setNewName] = useState('');
  const [, startTransition] = useTransition();

  async function reload() {
    setLoading(true);
    try {
      const list = await listPasskeysAction();
      setPasskeys(list);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Could not load passkeys';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    reload();
  }, []);

  async function onRegister() {
    setError(null);
    setMessage(null);

    if (!newName.trim()) {
      setError('Give the passkey a name first (e.g. "MacBook Touch ID")');
      return;
    }

    setBusy(true);
    try {
      const options = await passkeyRegisterBeginAction();
      const response = await startRegistration({ optionsJSON: options });
      const result = await passkeyRegisterFinishAction({
        response,
        friendlyName: newName.trim(),
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setMessage(`Registered "${result.passkey.friendlyName}"`);
      setNewName('');
      await reload();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Registration failed';
      setError(msg);
    } finally {
      setBusy(false);
    }
  }

  function onDelete(id: string) {
    setError(null);
    setMessage(null);
    startTransition(async () => {
      const result = await deletePasskeyAction(id);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setMessage('Passkey removed');
      await reload();
    });
  }

  function onRename(id: string, currentName: string) {
    const next = window.prompt('New name', currentName);
    if (next == null) return;
    const trimmed = next.trim();
    if (!trimmed || trimmed === currentName) return;

    startTransition(async () => {
      const result = await renamePasskeyAction(id, trimmed);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      await reload();
    });
  }

  return (
    <div className="settings-surface">
      <div className="settings-surface-head">
        <div>
          <h3>Passkeys</h3>
          <p>
            Face ID, Touch ID, YubiKey — cada dispositivo cuenta como una
            passkey independiente. Podés tener varias.
          </p>
        </div>
      </div>

      {message ? <div className="info-banner">{message}</div> : null}
      {error ? <div className="error-banner">{error}</div> : null}

      <div className="stack" style={{ gap: 8 }}>
        <div className="field">
          <label htmlFor="passkey-name">Nombre del nuevo passkey</label>
          <input
            className="input"
            id="passkey-name"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder='ej. "MacBook Touch ID"'
            disabled={busy}
          />
        </div>
        <button
          type="button"
          className="button"
          onClick={onRegister}
          disabled={busy}
        >
          {busy ? 'Esperando autenticador…' : 'Registrar nuevo passkey'}
        </button>
      </div>

      <div className="stack" style={{ gap: 8, marginTop: 16 }}>
        {loading ? (
          <p className="muted">Cargando passkeys…</p>
        ) : passkeys.length === 0 ? (
          <p className="muted">
            Todavía no registraste ninguno. Registrá el primero para poder
            iniciar sesión sin contraseña.
          </p>
        ) : (
          <ul className="stack" style={{ gap: 8, listStyle: 'none', padding: 0 }}>
            {passkeys.map((p) => (
              <li
                key={p.id}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '10px 12px',
                  border: '1px solid rgba(255,255,255,0.08)',
                  borderRadius: 8,
                }}
              >
                <div>
                  <strong>{p.friendlyName}</strong>
                  <div className="muted" style={{ fontSize: 12 }}>
                    {p.deviceType === 'multiDevice' ? 'Multi-device' : 'Single-device'}
                    {p.backedUp ? ' · Synced' : ' · Not synced'} · Last used:{' '}
                    {formatDate(p.lastUsedAt)}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button
                    type="button"
                    className="button ghost"
                    onClick={() => onRename(p.id, p.friendlyName)}
                  >
                    Renombrar
                  </button>
                  <button
                    type="button"
                    className="button ghost"
                    onClick={() => onDelete(p.id)}
                  >
                    Eliminar
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
