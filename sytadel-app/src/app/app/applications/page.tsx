import { PageHeader } from '@/components/page-header';
import {
  listApplications,
  listEnvironments,
  type ClientAppSummary,
  type EnvironmentSummary,
} from '@/lib/server/applications-client';
import { ApiError } from '@/lib/server/http';
import { requireSession, withSessionToken } from '@/lib/server/session';

const ENV_ORDER: Record<EnvironmentSummary['name'], number> = {
  production: 0,
  staging: 1,
  development: 2,
};

type AppWithEnvironments = ClientAppSummary & {
  environments: EnvironmentSummary[];
};

function formatDate(value: string) {
  return new Intl.DateTimeFormat('es-AR', { dateStyle: 'medium' }).format(
    new Date(value),
  );
}

export default async function ApplicationsPage() {
  await requireSession();

  let applications: AppWithEnvironments[] = [];
  let notice: string | null = null;

  try {
    applications = await withSessionToken(async (token, cookieStore) => {
      const tenantId = cookieStore.get('sentinel_tenant_id')?.value ?? '';
      const apps = await listApplications(token, tenantId);
      return Promise.all(
        apps.map(async (app) => ({
          ...app,
          environments: (
            await listEnvironments(token, tenantId, app.id)
          ).sort((a, b) => ENV_ORDER[a.name] - ENV_ORDER[b.name]),
        })),
      );
    });
  } catch (error) {
    if (error instanceof ApiError && error.status === 403) {
      notice =
        'Necesitás el Auth API Pack habilitado y rol OWNER/ADMIN para administrar aplicaciones.';
    } else {
      throw error;
    }
  }

  return (
    <div className="page-shell">
      <PageHeader
        eyebrow="Plataforma"
        title="Aplicaciones"
        description="Las aplicaciones cliente de tu organización que usan Sytadel, con sus entornos y API keys."
      />

      {notice ? <div className="info-banner">{notice}</div> : null}

      {!notice && applications.length === 0 ? (
        <div className="empty-card">
          Todavía no registraste aplicaciones. Creá una para emitir API keys por
          entorno.
        </div>
      ) : null}

      <div className="stack">
        {applications.map((app) => (
          <section key={app.id} className="panel stack-sm">
            <div className="panel-head">
              <div className="stack-sm">
                <h2 className="panel-title">{app.name}</h2>
                <span className="muted">{app.slug}</span>
              </div>
              <span className="status-badge">
                {app.isActive ? 'Activa' : 'Inactiva'}
              </span>
            </div>

            {app.description ? (
              <p className="section-copy">{app.description}</p>
            ) : null}

            <div className="subpanel stack-sm">
              <span className="settings-meta-label">Entornos</span>
              <div className="inline-actions">
                {app.environments.length === 0 ? (
                  <span className="muted">Sin entornos</span>
                ) : (
                  app.environments.map((environment) => (
                    <span key={environment.id} className="badge">
                      {environment.name}
                    </span>
                  ))
                )}
              </div>
            </div>

            <div className="subpanel stack-sm">
              <span className="settings-meta-label">
                API keys · {app.serviceAccounts.length}
              </span>
              {app.serviceAccounts.length === 0 ? (
                <span className="muted">Sin API keys</span>
              ) : (
                <ul className="detail-list">
                  {app.serviceAccounts.map((account) => (
                    <li key={account.id}>
                      <strong>{account.name}</strong>
                      <span className="muted"> · {account.secretPreview}</span>
                      {account.scopes.length > 0 ? (
                        <span className="muted">
                          {' '}
                          · {account.scopes.length} scopes
                        </span>
                      ) : null}
                      {!account.isActive ? (
                        <span className="badge"> revocada</span>
                      ) : null}
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <span className="muted">Creada el {formatDate(app.createdAt)}</span>
          </section>
        ))}
      </div>
    </div>
  );
}
