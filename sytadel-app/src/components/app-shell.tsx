import Link from 'next/link';
import { logoutAction } from '@/features/auth/actions';
import { SidebarNav } from '@/components/sidebar-nav';
import type { SessionState } from '@/lib/server/types';

type Props = {
  session: SessionState;
  children: React.ReactNode;
};

export function AppShell({ session, children }: Props) {
  const currentRole = session.roles[0] ?? 'MEMBER';

  return (
    <div className="dashboard-shell">
      <aside className="sidebar">
        <div className="brand-row">
          <span className="brand-mark" aria-hidden="true">
            <svg viewBox="0 0 128 128" fill="none">
              <path
                d="M83.5 38.5H55.5C47.5 38.5 42 43 42 49.5C42 56.2 46.6 59.6 56.2 62.1L67 64.9C73.4 66.5 76 68.4 76 72C76 76.2 72.4 79 66.2 79H37.8"
                stroke="url(#brand-mark-stroke-app-shell)"
                strokeWidth="10"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <path
                d="M46 93.5H74C82 93.5 87.5 89 87.5 82.5C87.5 75.8 82.9 72.4 73.3 69.9L62.5 67.1C56.1 65.5 53.5 63.6 53.5 60C53.5 55.8 57.1 53 63.3 53H91.7"
                stroke="url(#brand-mark-stroke-app-shell)"
                strokeWidth="10"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <defs>
                <linearGradient
                  id="brand-mark-stroke-app-shell"
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
            <div className="muted">Control operativo para acceso, Vault y Notary</div>
          </div>
        </div>

        <SidebarNav />
      </aside>

      <main className="main-shell">
        <header className="topbar">
          <div className="topbar-block">
            <div className="topbar-kicker">Workspace activo</div>
            <div className="topbar-meta">
              <span className="plan-badge">{session.tenant.planCode ?? 'FREE'}</span>
              <span className="badge">{session.tenant.name}</span>
              {session.tenant.billingBypass ? (
                <span className="status-badge">Billing bypass</span>
              ) : null}
              <span className="status-badge">{currentRole}</span>
            </div>
          </div>

          <div className="topbar-meta topbar-meta-right">
            <span className="muted topbar-email">{session.user.email}</span>
            <form action={logoutAction}>
              <button className="button-ghost" type="submit">
                Cerrar sesión
              </button>
            </form>
          </div>
        </header>

        {!session.tenant.isActive ? (
          <div className="error-banner">
            Esta organización está inactiva. {currentRole === 'OWNER'
              ? 'Podés reactivarla desde Configuración y revisar el plan en Facturación.'
              : 'Solo una cuenta OWNER puede reactivarla.'}
          </div>
        ) : null}

        {children}
      </main>
    </div>
  );
}
