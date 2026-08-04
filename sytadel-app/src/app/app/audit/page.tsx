import { getCapabilities } from '@/lib/server/capabilities';
import { PageHeader } from '@/components/page-header';
import { getServerAccessTokenOrRedirect, requireOperationalSession } from '@/lib/server/session';
import * as authClient from '@/lib/server/auth-client';
import * as vaultClient from '@/lib/server/vault-client';
import { formatDate, formatName } from '@/lib/ui/format';

type Props = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

function readString(
  params: Record<string, string | string[] | undefined>,
  key: string,
) {
  return typeof params[key] === 'string' ? (params[key] as string) : '';
}

function readNumber(
  params: Record<string, string | string[] | undefined>,
  key: string,
  fallback: number,
) {
  const raw = typeof params[key] === 'string' ? Number(params[key]) : NaN;
  return Number.isFinite(raw) && raw > 0 ? raw : fallback;
}

export default async function AuditPage({ searchParams }: Props) {
  const session = await requireOperationalSession();
  const accessToken = await getServerAccessTokenOrRedirect();
  const params = (await searchParams) ?? {};
  const page = readNumber(params, 'page', 1);
  const limit = readNumber(params, 'limit', 20);
  const action = readString(params, 'action');
  const resourceType = readString(params, 'resourceType');
  const outcome = readString(params, 'outcome');
  const from = readString(params, 'from');
  const to = readString(params, 'to');
  const capabilities = getCapabilities(session);

  if (!capabilities.canManageMembersByRole) {
    return (
      <div className="page-shell">
        <PageHeader
          eyebrow="Audit / Trazabilidad"
          title="Log auditable del tenant"
          description="La lectura del log está disponible para perfiles con permisos de administración."
        />
        <div className="upgrade-banner">
          <div>
            <strong>Tu rol actual no puede consultar audit logs.</strong>
            <p className="muted">
              Ingresá como ADMIN u OWNER para usar los filtros y revisar la cadena de eventos.
            </p>
          </div>
        </div>
      </div>
    );
  }

  const [audit, memberships] = await Promise.all([
    vaultClient.listAuditLogs(accessToken, {
      page,
      limit,
      action: action || undefined,
      resourceType: resourceType || undefined,
      outcome: outcome === 'SUCCESS' || outcome === 'FAILURE' ? outcome : undefined,
      from: from || undefined,
      to: to || undefined,
    }),
    authClient.listTenantMemberships(accessToken, session.tenant.id),
  ]);

  const totalPages = Math.max(1, Math.ceil(audit.total / audit.limit));
  const canGoPrev = audit.page > 1;
  const canGoNext = audit.page < totalPages;
  const userMap = new Map(
    memberships.map((membership) => [membership.userId, membership.user]),
  );

  return (
    <div className="page-shell">
        <PageHeader
          eyebrow="Audit / Trazabilidad"
          title="Log auditable del tenant"
          description="Consultá eventos operativos, filtrá por acción y seguí la trazabilidad del tenant con más contexto."
      >
        <div className="stack-sm">
          <span className="badge">{audit.total} eventos</span>
          <span className="badge">
            Pagina {audit.page} / {totalPages}
          </span>
        </div>
      </PageHeader>

      <section className="panel">
        <div className="panel-head">
          <h2 className="panel-title">Filtros</h2>
        </div>

        <form action="/app/audit" className="stack" method="get">
          <div className="grid-4">
            <div className="field">
              <label htmlFor="action">Acción</label>
              <input
                className="input"
                defaultValue={action}
                id="action"
                name="action"
                placeholder="DOCUMENT_UPLOAD"
              />
            </div>
            <div className="field">
              <label htmlFor="resourceType">Tipo de recurso</label>
              <input
                className="input"
                defaultValue={resourceType}
                id="resourceType"
                name="resourceType"
                placeholder="document"
              />
            </div>
            <div className="field">
              <label htmlFor="outcome">Resultado</label>
              <select className="select" defaultValue={outcome} id="outcome" name="outcome">
                <option value="">Todos</option>
                <option value="SUCCESS">SUCCESS</option>
                <option value="FAILURE">FAILURE</option>
              </select>
            </div>
            <div className="field">
              <label htmlFor="limit">Eventos por página</label>
              <select className="select" defaultValue={String(limit)} id="limit" name="limit">
                <option value="10">10</option>
                <option value="20">20</option>
                <option value="50">50</option>
              </select>
            </div>
          </div>

          <div className="grid-2">
            <div className="field">
              <label htmlFor="from">Desde</label>
              <input className="input" defaultValue={from} id="from" name="from" type="datetime-local" />
            </div>
            <div className="field">
              <label htmlFor="to">Hasta</label>
              <input className="input" defaultValue={to} id="to" name="to" type="datetime-local" />
            </div>
          </div>

          <div className="inline-actions">
            <button className="button" type="submit">
              Aplicar filtros
            </button>
            <a className="button-secondary" href="/app/audit">
              Limpiar
            </a>
          </div>
        </form>
      </section>

      <section className="table-shell">
        <div className="panel-head" style={{ padding: '18px 18px 0' }}>
          <h2 className="panel-title">Eventos recientes</h2>
        </div>
        <table>
          <thead>
            <tr>
              <th>Fecha</th>
              <th>Acción</th>
              <th>Recurso</th>
              <th>Usuario</th>
              <th>HTTP</th>
              <th>Resultado</th>
              <th>Seq</th>
            </tr>
          </thead>
          <tbody>
            {audit.items.length ? (
              audit.items.map((item) => {
                const user = item.userId ? userMap.get(item.userId) : undefined;

                return (
                  <tr key={item.id}>
                    <td>{formatDate(item.createdAt)}</td>
                    <td>
                      <div className="stack-xs">
                        <strong>{item.action}</strong>
                        <span className="muted">{item.httpPath}</span>
                      </div>
                    </td>
                    <td>
                      <div className="stack-xs">
                        <strong>{item.resourceType}</strong>
                        <span className="muted">{item.resourceId ?? 'Sin resourceId'}</span>
                      </div>
                    </td>
                    <td>
                      <div className="stack-xs">
                        <strong>{formatName(user ?? {})}</strong>
                        <span className="muted">{user?.email ?? item.userId ?? 'Sistema'}</span>
                      </div>
                    </td>
                    <td>
                      <div className="stack-xs">
                        <strong>{item.httpMethod}</strong>
                        <span className="muted">{item.httpStatus}</span>
                      </div>
                    </td>
                    <td>
                      <span
                        className={item.outcome === 'SUCCESS' ? 'status-badge' : 'badge badge-danger'}
                      >
                        {item.outcome}
                      </span>
                    </td>
                    <td>{item.seq}</td>
                  </tr>
                );
              })
            ) : (
              <tr>
                <td colSpan={7}>No hay eventos para los filtros seleccionados.</td>
              </tr>
            )}
          </tbody>
        </table>
      </section>

      <section className="pagination-row">
        <a
          className={canGoPrev ? 'button-secondary' : 'button-secondary button-disabled'}
          href={
            canGoPrev
              ? `/app/audit?${new URLSearchParams({
                  ...(action ? { action } : {}),
                  ...(resourceType ? { resourceType } : {}),
                  ...(outcome ? { outcome } : {}),
                  ...(from ? { from } : {}),
                  ...(to ? { to } : {}),
                  limit: String(limit),
                  page: String(page - 1),
                }).toString()}`
              : '#'
          }
        >
          Anterior
        </a>
        <span className="muted">
          Mostrando {audit.items.length} de {audit.total}
        </span>
        <a
          className={canGoNext ? 'button-secondary' : 'button-secondary button-disabled'}
          href={
            canGoNext
              ? `/app/audit?${new URLSearchParams({
                  ...(action ? { action } : {}),
                  ...(resourceType ? { resourceType } : {}),
                  ...(outcome ? { outcome } : {}),
                  ...(from ? { from } : {}),
                  ...(to ? { to } : {}),
                  limit: String(limit),
                  page: String(page + 1),
                }).toString()}`
              : '#'
          }
        >
          Siguiente
        </a>
      </section>
    </div>
  );
}
