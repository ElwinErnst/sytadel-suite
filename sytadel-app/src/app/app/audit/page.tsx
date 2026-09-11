import { getCapabilities } from '@/lib/server/capabilities';
import { PageHeader } from '@/components/page-header';
import {
  getServerAccessTokenOrRedirect,
  requireOperationalSession,
} from '@/lib/server/session';
import * as authClient from '@/lib/server/auth-client';
import * as vaultClient from '@/lib/server/vault-client';
import * as ztClient from '@/lib/server/zt-client';
import * as ztPolicyClient from '@/lib/server/zt-policy-client';
import {
  fromAuditEvent,
  fromPolicyVersion,
  fromVaultLog,
  mergeTimeline,
  type VaultAuditLogItem,
} from '@/lib/ui/audit-timeline';
import { formatDate, formatName } from '@/lib/ui/format';

type Props = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

const WINDOW = 50;

const SYSTEM_TABS: Array<{ value: string; label: string }> = [
  { value: '', label: 'Todos' },
  { value: 'vault', label: 'Vault' },
  { value: 'auth', label: 'Auth' },
  { value: 'zerotrust', label: 'Zero Trust' },
];

function readString(
  params: Record<string, string | string[] | undefined>,
  key: string,
) {
  return typeof params[key] === 'string' ? (params[key] as string) : '';
}

export default async function AuditPage({ searchParams }: Props) {
  const session = await requireOperationalSession();
  const accessToken = await getServerAccessTokenOrRedirect();
  const params = (await searchParams) ?? {};
  const systemFilter = readString(params, 'system');
  const capabilities = getCapabilities(session);

  if (!capabilities.canManageMembersByRole) {
    return (
      <div className="page-shell">
        <PageHeader
          eyebrow="Audit / Trazabilidad"
          title="Auditoría del tenant"
          description="La lectura del log está disponible para perfiles con permisos de administración."
        />
        <div className="upgrade-banner">
          <div>
            <strong>Tu rol actual no puede consultar audit logs.</strong>
            <p className="muted">
              Ingresá como ADMIN u OWNER para revisar la trazabilidad del
              tenant.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Each source is fetched independently and degrades to empty on failure, so
  // one system being down never blanks the whole timeline.
  const [vaultRes, memberships, policyVersions, authRes, ztRes] =
    await Promise.all([
      vaultClient
        .listAuditLogs(accessToken, { page: 1, limit: WINDOW })
        .catch(() => null),
      authClient
        .listTenantMemberships(accessToken, session.tenant.id)
        .catch(() => []),
      ztPolicyClient
        .listPolicyVersions(accessToken, session.tenant.id)
        .catch(() => []),
      authClient
        .listAuthAuditEvents(accessToken, session.tenant.id, { limit: WINDOW })
        .catch(() => null),
      ztClient.listZtAuditEvents(accessToken, { limit: WINDOW }).catch(() => null),
    ]);

  const userMap = new Map(
    memberships.map((membership) => [membership.userId, membership.user]),
  );

  const timeline = mergeTimeline([
    (vaultRes?.items ?? []).map((item) =>
      fromVaultLog(item as unknown as VaultAuditLogItem),
    ),
    (authRes?.items ?? []).map(fromAuditEvent),
    (ztRes?.items ?? []).map(fromAuditEvent),
    policyVersions.map(fromPolicyVersion),
  ]).filter((event) => !systemFilter || event.system === systemFilter);

  return (
    <div className="page-shell">
      <PageHeader
        eyebrow="Audit / Trazabilidad"
        title="Auditoría del tenant"
        description="La trazabilidad de tus sistemas en una sola línea de tiempo: accesos a documentos (Vault), decisiones y cambios de política (Zero Trust) y accesos de identidad (Auth)."
      >
        <span className="badge">{timeline.length} eventos recientes</span>
      </PageHeader>

      <section className="panel">
        <div className="inline-actions">
          {SYSTEM_TABS.map((tab) => {
            const href = tab.value
              ? `/app/audit?system=${tab.value}`
              : '/app/audit';
            const active = systemFilter === tab.value;
            return (
              <a
                key={tab.value || 'all'}
                className={active ? 'button' : 'button-secondary'}
                href={href}
              >
                {tab.label}
              </a>
            );
          })}
        </div>
      </section>

      <section className="table-shell">
        <table>
          <thead>
            <tr>
              <th>Fecha</th>
              <th>Sistema</th>
              <th>Categoría</th>
              <th>Acción</th>
              <th>Actor</th>
              <th>Resultado</th>
            </tr>
          </thead>
          <tbody>
            {timeline.length ? (
              timeline.map((event) => {
                const actor = event.actorId
                  ? userMap.get(event.actorId)
                  : undefined;
                const positive =
                  event.outcome === 'success' || event.outcome === 'allow';

                return (
                  <tr key={event.key}>
                    <td>{formatDate(event.occurredAt)}</td>
                    <td>
                      <span className="badge">{event.system}</span>
                    </td>
                    <td>
                      <span className="muted">{event.category}</span>
                    </td>
                    <td>
                      <div className="stack-xs">
                        <strong>{event.action}</strong>
                        {event.detail ? (
                          <span className="muted">{event.detail}</span>
                        ) : null}
                      </div>
                    </td>
                    <td>
                      <div className="stack-xs">
                        <strong>{formatName(actor ?? {})}</strong>
                        <span className="muted">
                          {actor?.email ?? event.actorId ?? 'Sistema'}
                        </span>
                      </div>
                    </td>
                    <td>
                      <span
                        className={
                          positive ? 'status-badge' : 'badge badge-danger'
                        }
                      >
                        {event.outcome}
                      </span>
                    </td>
                  </tr>
                );
              })
            ) : (
              <tr>
                <td colSpan={6}>
                  No hay eventos recientes para el filtro seleccionado.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </section>
    </div>
  );
}
