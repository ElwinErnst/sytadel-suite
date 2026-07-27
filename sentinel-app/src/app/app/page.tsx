import { PageHeader } from '@/components/page-header';
import { createTenantAction } from '@/features/access/actions';
import * as authClient from '@/lib/server/auth-client';
import { getCapabilities } from '@/lib/server/capabilities';
import { getServerAccessTokenOrRedirect, requireOperationalSession } from '@/lib/server/session';
import * as vaultClient from '@/lib/server/vault-client';
import { formatDate, formatName } from '@/lib/ui/format';

type Props = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function AppOverviewPage({ searchParams }: Props) {
  const session = await requireOperationalSession();
  const accessToken = await getServerAccessTokenOrRedirect();
  const params = (await searchParams) ?? {};
  const error = typeof params.error === 'string' ? params.error : null;
  const message = typeof params.message === 'string' ? params.message : null;

  const [vaults, userMemberships] = await Promise.all([
    vaultClient.listVaults(accessToken),
    authClient.listUserMemberships(accessToken, session.user.id),
  ]);

  const capabilities = getCapabilities(session, { vaultCount: vaults.length });
  const memberships = capabilities.canManageMembersByRole
    ? await authClient.listTenantMemberships(accessToken, session.tenant.id)
    : [];
  const recentVaults = vaults.slice(0, 4);
  const recentMembers = memberships.slice(0, 4);

  return (
    <div className="page-shell">
      <PageHeader
        eyebrow="Resumen / Sytadel"
        title="Centro operativo del tenant"
        description="Una vista clara del plan activo, la capacidad disponible y los accesos que hoy tiene tu equipo."
      >
        <div className="stack-sm">
          <span className="badge">Plan {session.tenant.planCode ?? 'FREE'}</span>
          <span className="badge">
            ZT {session.tenant.ztPoliciesEnabled ? 'habilitado' : 'deshabilitado'}
          </span>
          <span className="badge">
            Vaults {session.tenant.vaultsEnabled ? 'habilitados' : 'deshabilitados'}
          </span>
        </div>
      </PageHeader>

      {message ? <div className="info-banner">{message}</div> : null}
      {error ? <div className="error-banner">{error}</div> : null}

      <section className="stats-grid">
        <article className="summary-card">
          <p className="metric-value">{vaults.length}</p>
          <p>Vaults activos</p>
        </article>
        <article className="summary-card">
          <p className="metric-value">{memberships.length}</p>
          <p>Miembros con acceso</p>
        </article>
        <article className="summary-card">
          <p className="metric-value">{session.roles[0]}</p>
          <p>Tu rol actual</p>
        </article>
      </section>

      {!capabilities.canUseAdvancedSecurity ? (
        <section className="upgrade-banner">
          <div>
            <strong>Tu plan actual tiene funciones avanzadas limitadas.</strong>
            <p className="muted">
              Podés seguir operando con las funciones incluidas o ampliar capacidad desde Facturación.
            </p>
          </div>
          <span className="badge">Plan {session.tenant.planCode ?? 'FREE'}</span>
        </section>
      ) : null}

      <section className="split-panels">
        <article className="panel">
          <div className="panel-head">
            <h2 className="panel-title">Contexto del tenant</h2>
          </div>
          <dl className="detail-list">
            <div>
              <dt>Tenant</dt>
              <dd>{session.tenant.name}</dd>
            </div>
            <div>
              <dt>Slug</dt>
              <dd>{session.tenant.slug}</dd>
            </div>
            <div>
              <dt>Plan</dt>
              <dd>{session.tenant.planCode ?? 'FREE'}</dd>
            </div>
            <div>
              <dt>Máximo de vaults</dt>
              <dd>{capabilities.maxVaults ?? 'Ilimitado'}</dd>
            </div>
            <div>
              <dt>Cuenta activa</dt>
              <dd>{formatName(session.user)}</dd>
            </div>
            <div>
              <dt>Email</dt>
              <dd>{session.user.email}</dd>
            </div>
          </dl>
        </article>

        <article className="panel">
          <div className="panel-head">
            <h2 className="panel-title">Capacidades activas</h2>
          </div>
          <div className="stack-sm">
            <span className="badge">
              {capabilities.canManageMembers ? 'Gestiona miembros' : 'Sin gestión de miembros'}
            </span>
            <span className="badge">
              {capabilities.canCreateVault ? 'Puede crear vaults' : 'Límite de vaults alcanzado'}
            </span>
            <span className="badge">
              {capabilities.canUploadDocuments
                ? 'Carga habilitada'
                : capabilities.canUploadDocumentsByRole
                  ? 'Carga no disponible'
                  : 'Carga reservada a ADMIN y OWNER'}
            </span>
            <span className="badge">
              {capabilities.canUseAdvancedSecurity
                ? 'Funciones avanzadas habilitadas'
                : 'Funciones avanzadas limitadas'}
            </span>
          </div>
        </article>
      </section>

      <section className="grid-2">
        <article className="panel">
          <div className="panel-head">
            <h2 className="panel-title">Estado del tenant</h2>
          </div>
          <div className="stack-sm">
            <div className="status-row">
              <span>Tenant activo</span>
              <span className={session.tenant.isActive ? 'status-badge' : 'badge'}>
                {session.tenant.isActive ? 'Activo' : 'Inactivo'}
              </span>
            </div>
            <div className="status-row">
              <span>Políticas Zero Trust</span>
              <span
                className={
                  session.tenant.ztPoliciesEnabled ? 'status-badge' : 'badge'
                }
              >
                {session.tenant.ztPoliciesEnabled ? 'Habilitadas' : 'Deshabilitadas'}
              </span>
            </div>
            <div className="status-row">
              <span>Funciones de Vault</span>
              <span
                className={session.tenant.vaultsEnabled ? 'status-badge' : 'badge'}
              >
                {session.tenant.vaultsEnabled ? 'Habilitadas' : 'Deshabilitadas'}
              </span>
            </div>
            <div className="status-row">
              <span>Capacidad de vaults</span>
              <span className={capabilities.hasVaultCapacity ? 'status-badge' : 'badge'}>
                {capabilities.maxVaults == null
                  ? 'Sin límite'
                  : `${vaults.length}/${capabilities.maxVaults}`}
              </span>
            </div>
          </div>
        </article>

        <article className="panel">
          <div className="panel-head">
            <h2 className="panel-title">Lectura rápida</h2>
          </div>
          <div className="stack-sm">
            <p className="muted">
              Acá ves si el tenant está listo para operar, cuánto margen queda en el plan y qué funciones están habilitadas hoy.
            </p>
            <p className="muted">
              Es una referencia rápida para detectar límites, revisar disponibilidad y decidir el siguiente paso sin entrar a cada módulo.
            </p>
          </div>
        </article>
      </section>

      <section className="grid-2">
        <article className="panel">
          <div className="panel-head">
            <h2 className="panel-title">Crear un nuevo tenant</h2>
          </div>
          <form action={createTenantAction} className="stack" method="post">
            <div className="field">
              <label htmlFor="tenantName">Nombre</label>
              <input className="input" id="tenantName" name="name" placeholder="Acme Legal" required />
            </div>
            <div className="field">
              <label htmlFor="tenantSlug">Slug</label>
              <input className="input" id="tenantSlug" name="slug" placeholder="acme-legal" required />
            </div>
            <p className="hint">
              Se crea con tu cuenta como OWNER. Después podés entrar usando el nuevo slug.
            </p>
            <button className="button" type="submit">
              Crear tenant
            </button>
          </form>
        </article>

        <article className="table-shell">
          <div className="panel-head" style={{ padding: '18px 18px 0' }}>
            <h2 className="panel-title">Tus tenants</h2>
          </div>
          <table>
            <thead>
              <tr>
                <th>Tenant</th>
                <th>Rol</th>
                <th>Estado</th>
              </tr>
            </thead>
            <tbody>
              {userMemberships.length ? (
                userMemberships.map((membership) => (
                  <tr key={membership.id}>
                    <td>
                      <div className="stack-xs">
                        <strong>{membership.tenant?.name ?? membership.tenantId}</strong>
                        <span className="muted">{membership.tenant?.slug ?? membership.tenantId}</span>
                      </div>
                    </td>
                    <td>{membership.role}</td>
                    <td>{membership.isActive ? 'Activo' : 'Inactivo'}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={3}>No hay tenants asociados a este usuario.</td>
                </tr>
              )}
            </tbody>
          </table>
        </article>
      </section>

      <section className="grid-2">
        <article className="table-shell">
          <div className="panel-head" style={{ padding: '18px 18px 0' }}>
            <h2 className="panel-title">Vaults recientes</h2>
          </div>
          <table>
            <thead>
              <tr>
                <th>Nombre</th>
                <th>Slug</th>
                <th>Creado</th>
              </tr>
            </thead>
            <tbody>
              {recentVaults.length ? (
                recentVaults.map((vault) => (
                  <tr key={vault.id}>
                    <td>{vault.name}</td>
                    <td>{vault.slug}</td>
                    <td>{formatDate(vault.createdAt)}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={3}>Todavía no hay vaults creados.</td>
                </tr>
              )}
            </tbody>
          </table>
        </article>

        <article className="table-shell">
          <div className="panel-head" style={{ padding: '18px 18px 0' }}>
            <h2 className="panel-title">Acceso reciente</h2>
          </div>
          <table>
            <thead>
              <tr>
                <th>Usuario</th>
                <th>Rol</th>
                <th>Estado</th>
              </tr>
            </thead>
            <tbody>
              {recentMembers.length ? (
                recentMembers.map((membership) => (
                  <tr key={membership.id}>
                    <td>{formatName(membership.user ?? {})}</td>
                    <td>{membership.role}</td>
                    <td>{membership.isActive ? 'Activo' : 'Inactivo'}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={3}>No se encontraron memberships para este tenant.</td>
                </tr>
              )}
            </tbody>
          </table>
        </article>
      </section>
    </div>
  );
}
