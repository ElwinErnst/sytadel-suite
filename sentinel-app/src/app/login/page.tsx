import { redirect } from 'next/navigation';
import { loginAction } from '@/features/auth/actions';
import { PasskeyLoginButton } from '@/features/auth/passkey-login-button';
import { getCurrentSession } from '@/lib/server/session';

type Props = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function LoginPage({ searchParams }: Props) {
  const session = await getCurrentSession();
  if (session) {
    redirect(session.tenant.isActive ? '/app' : '/app/settings');
  }

  const params = (await searchParams) ?? {};
  const error =
    typeof params.error === 'string'
      ? params.error
      : 'string' === typeof params.message
        ? params.message
        : null;

  return (
    <main className="auth-shell">
      <section className="auth-card stack">
        <div className="brand-row">
          <span className="brand-mark" aria-hidden="true">
            <svg viewBox="0 0 128 128" fill="none">
              <path
                d="M83.5 38.5H55.5C47.5 38.5 42 43 42 49.5C42 56.2 46.6 59.6 56.2 62.1L67 64.9C73.4 66.5 76 68.4 76 72C76 76.2 72.4 79 66.2 79H37.8"
                stroke="url(#brand-mark-stroke-login)"
                strokeWidth="10"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <path
                d="M46 93.5H74C82 93.5 87.5 89 87.5 82.5C87.5 75.8 82.9 72.4 73.3 69.9L62.5 67.1C56.1 65.5 53.5 63.6 53.5 60C53.5 55.8 57.1 53 63.3 53H91.7"
                stroke="url(#brand-mark-stroke-login)"
                strokeWidth="10"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <defs>
                <linearGradient
                  id="brand-mark-stroke-login"
                  x1="30"
                  y1="26"
                  x2="95"
                  y2="102"
                  gradientUnits="userSpaceOnUse"
                >
                  <stop stopColor="#F8F2FF" />
                  <stop offset="1" stopColor="#E6D8FF" />
                </linearGradient>
              </defs>
            </svg>
          </span>
          <div>
            <div className="brand-text">Sytadel Console</div>
            <div className="muted">Auth + Vault para la operacion inicial</div>
          </div>
        </div>

        <div>
          <h1>Entrá a tu tenant</h1>
          <p>
            Usa identidad centralizada de Sytadel y opera vaults y documentos
            desde una sola interfaz.
          </p>
        </div>

        {error ? <div className="error-banner">{error}</div> : null}

        <form action={loginAction} className="stack">
          <div className="field">
            <label htmlFor="email">Email</label>
            <input
              className="input"
              defaultValue="admin@test.com"
              id="email"
              name="email"
              type="email"
              required
            />
          </div>

          <div className="field">
            <label htmlFor="password">Password</label>
            <input
              className="input"
              defaultValue="123456"
              id="password"
              name="password"
              type="password"
              required
            />
          </div>

          <div className="field">
            <label htmlFor="tenantSlug">Tenant slug</label>
            <input
              className="input"
              defaultValue="sentinel-labs"
              id="tenantSlug"
              name="tenantSlug"
              required
            />
          </div>

          <button className="button" type="submit">
            Ingresar al dashboard
          </button>
        </form>

        <div
          aria-hidden="true"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            color: 'var(--muted, #888)',
            fontSize: 13,
          }}
        >
          <div style={{ flex: 1, height: 1, background: 'currentColor', opacity: 0.2 }} />
          <span>or</span>
          <div style={{ flex: 1, height: 1, background: 'currentColor', opacity: 0.2 }} />
        </div>

        <PasskeyLoginButton />

        <div className="info-banner">
          Demo local: <strong>admin@test.com</strong> / <strong>123456</strong> /{' '}
          <strong>sentinel-labs</strong>. Registrá un passkey desde
          <strong> Settings</strong> después del primer login para habilitar el
          botón de arriba.
        </div>

        <p className="hint">
          Si aparece un error de conexión, levantá primero `auth-api` o el stack completo con
          `docker compose up --build`.
        </p>
      </section>
    </main>
  );
}
