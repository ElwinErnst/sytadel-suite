import Link from 'next/link';
import { PageHeader } from '@/components/page-header';
import {
  getApplication,
  listEnvironments,
  type EnvironmentSummary,
} from '@/lib/server/applications-client';
import {
  getUsageByApplication,
  listProviderConnections,
  listWebhookEndpoints,
  type ProviderConnectionSummary,
  type UsageApplication,
  type WebhookEndpointSummary,
} from '@/lib/server/billing-platform-client';
import { ApiError } from '@/lib/server/http';
import { requireSession, withSessionToken } from '@/lib/server/session';
import type { ClientAppSummary } from '@/lib/server/applications-client';

type Props = { params: Promise<{ appId: string }> };

type DetailData = {
  app: ClientAppSummary | null;
  environments: EnvironmentSummary[];
  providers: ProviderConnectionSummary[];
  webhooks: WebhookEndpointSummary[];
  usage: UsageApplication | null;
};

export default async function ApplicationDetailPage({ params }: Props) {
  const { appId } = await params;
  await requireSession();

  let data: DetailData | null = null;
  let notice: string | null = null;

  try {
    data = await withSessionToken(async (token, cookieStore) => {
      const tenantId = cookieStore.get('sentinel_tenant_id')?.value ?? '';
      const [app, environments, providers, webhooks, usage] = await Promise.all([
        getApplication(token, tenantId, appId),
        listEnvironments(token, tenantId, appId),
        listProviderConnections(token),
        listWebhookEndpoints(token),
        getUsageByApplication(token),
      ]);
      const forApp = <T extends { clientAppId: string | null }>(rows: T[]) =>
        rows.filter((r) => r.clientAppId === appId || r.clientAppId === null);
      return {
        app,
        environments,
        providers: forApp(providers),
        webhooks: forApp(webhooks),
        usage: usage.applications.find((a) => a.clientAppId === appId) ?? null,
      };
    });
  } catch (error) {
    if (error instanceof ApiError && error.status === 403) {
      notice =
        'Necesitás el Auth API Pack habilitado y rol OWNER/ADMIN para ver esta aplicación.';
    } else {
      throw error;
    }
  }

  const envName = (id: string | null) =>
    id === null
      ? 'org'
      : (data?.environments.find((e) => e.id === id)?.name ?? id.slice(0, 8));

  if (notice) {
    return (
      <div className="page-shell">
        <PageHeader eyebrow="Aplicación" title="Aplicación" description="" />
        <div className="info-banner">{notice}</div>
        <Link className="nav-link" href="/app/applications">
          ← Volver a Aplicaciones
        </Link>
      </div>
    );
  }

  if (!data?.app) {
    return (
      <div className="page-shell">
        <PageHeader
          eyebrow="Aplicación"
          title="No encontrada"
          description="Esta aplicación no existe o no pertenece a tu organización."
        />
        <Link className="nav-link" href="/app/applications">
          ← Volver a Aplicaciones
        </Link>
      </div>
    );
  }

  const { app, environments, providers, webhooks, usage } = data;

  return (
    <div className="page-shell">
      <PageHeader
        eyebrow="Aplicación"
        title={app.name}
        description={app.description ?? app.slug}
      >
        <Link className="button-secondary" href="/app/applications">
          ← Aplicaciones
        </Link>
      </PageHeader>

      <section className="panel stack-sm">
        <div className="panel-head">
          <span className="panel-title">Entornos</span>
          <span className="status-badge">{app.isActive ? 'Activa' : 'Inactiva'}</span>
        </div>
        <div className="inline-actions">
          {environments.length === 0 ? (
            <span className="muted">Sin entornos</span>
          ) : (
            environments.map((environment) => (
              <span key={environment.id} className="badge">
                {environment.name}
              </span>
            ))
          )}
        </div>
      </section>

      <section className="panel stack-sm">
        <span className="panel-title">API keys · {app.serviceAccounts.length}</span>
        {app.serviceAccounts.length === 0 ? (
          <span className="muted">Sin API keys</span>
        ) : (
          <ul className="detail-list">
            {app.serviceAccounts.map((account) => (
              <li key={account.id}>
                <strong>{account.name}</strong>
                <span className="muted"> · {envName(account.environmentId)}</span>
                <span className="muted"> · {account.scopes.length} scopes</span>
                <span className="muted"> · {account.secretPreview}</span>
                {!account.isActive ? <span className="badge"> revocada</span> : null}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="panel stack-sm">
        <span className="panel-title">Provider connections · {providers.length}</span>
        {providers.length === 0 ? (
          <span className="muted">Sin conexiones de proveedor</span>
        ) : (
          <ul className="detail-list">
            {providers.map((connection) => (
              <li key={connection.id}>
                <strong>{connection.provider}</strong>
                <span className="muted"> · {envName(connection.environmentId)}</span>
                <span className="muted"> · {connection.status}</span>
                {connection.clientAppId === null ? (
                  <span className="badge"> org</span>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="panel stack-sm">
        <span className="panel-title">Webhook endpoints · {webhooks.length}</span>
        {webhooks.length === 0 ? (
          <span className="muted">Sin webhook endpoints</span>
        ) : (
          <ul className="detail-list">
            {webhooks.map((endpoint) => (
              <li key={endpoint.id}>
                <strong>{endpoint.url}</strong>
                <span className="muted"> · {envName(endpoint.environmentId)}</span>
                <span className="muted"> · {endpoint.events.join(', ')}</span>
                {!endpoint.enabled ? <span className="badge"> off</span> : null}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="panel stack-sm">
        <span className="panel-title">Uso</span>
        {!usage || usage.environments.length === 0 ? (
          <span className="muted">Sin eventos de uso registrados</span>
        ) : (
          <ul className="detail-list">
            {usage.environments.map((environment) => (
              <li key={environment.environmentId ?? 'none'}>
                <strong>{envName(environment.environmentId)}</strong>
                <span className="muted"> · {environment.totalQuantity} eventos</span>
                <span className="muted">
                  {' '}
                  ·{' '}
                  {environment.metrics
                    .map((metric) => `${metric.metric} (${metric.quantity})`)
                    .join(', ')}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
