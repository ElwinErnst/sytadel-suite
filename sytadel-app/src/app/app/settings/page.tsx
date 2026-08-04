import Link from 'next/link';
import { PageHeader } from '@/components/page-header';
import { PasskeysPanel } from '@/features/auth/passkeys-panel';
import {
  logoutAllSessionsAction,
  updateProfileAction,
  updateTenantSettingsAction,
} from '@/features/settings/actions';
import { requireSession } from '@/lib/server/session';

type Props = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function SettingsPage({ searchParams }: Props) {
  const session = await requireSession();
  const params = (await searchParams) ?? {};
  const error = typeof params.error === 'string' ? params.error : null;
  const message = typeof params.message === 'string' ? params.message : null;
  const isOwner = session.roles.includes('OWNER');
  const currentPlan = session.tenant.entitlements.planCode ?? session.tenant.planCode ?? 'FREE';
  const maxVaults = session.tenant.entitlements.limits.maxVaults ?? session.tenant.maxVaults;
  const maxUsers = session.tenant.entitlements.limits.maxUsers;
  const monthlyNotaryRequests = session.tenant.entitlements.limits.monthlyNotaryRequests;

  return (
    <div className="page-shell">
      <PageHeader
        eyebrow="Configuración / Cuenta y tenant"
        title="Configuración"
        description="Administrá tu perfil, la seguridad de la sesión y la información principal de tu organización desde una vista más clara."
      />

      {message ? <div className="info-banner">{message}</div> : null}
      {error ? <div className="error-banner">{error}</div> : null}

      <section className="stats-grid">
        <article className="summary-card">
          <p className="metric-value">{currentPlan}</p>
          <p>Plan actual</p>
        </article>
        <article className="summary-card">
          <p className="metric-value">{session.roles[0] ?? 'MEMBER'}</p>
          <p>Tu rol dentro del tenant</p>
        </article>
        <article className="summary-card">
          <p className="metric-value">{session.tenant.isActive ? 'Activo' : 'Inactivo'}</p>
          <p>Estado general de la organización</p>
        </article>
      </section>

      <section className="split-panels">
        <article className="panel settings-main-panel">
          <div className="panel-head">
            <h2 className="panel-title">Cuenta y seguridad</h2>
            <span className="badge">{session.user.email}</span>
          </div>

          <div className="settings-card-stack">
            <div className="settings-surface">
              <div className="settings-surface-head">
                <div>
                  <h3>Perfil</h3>
                  <p>Actualizá cómo se muestra tu cuenta dentro del workspace.</p>
                </div>
              </div>

              <form action={updateProfileAction} className="stack" method="post">
                <div className="grid-2">
                  <div className="field">
                    <label htmlFor="firstName">Nombre</label>
                    <input
                      className="input"
                      defaultValue={session.user.firstName ?? ''}
                      id="firstName"
                      name="firstName"
                      placeholder="Nombre"
                    />
                  </div>
                  <div className="field">
                    <label htmlFor="lastName">Apellido</label>
                    <input
                      className="input"
                      defaultValue={session.user.lastName ?? ''}
                      id="lastName"
                      name="lastName"
                      placeholder="Apellido"
                    />
                  </div>
                </div>

                <button className="button" type="submit">
                  Guardar cambios
                </button>
              </form>
            </div>

            <div className="settings-surface">
              <div className="settings-surface-head">
                <div>
                  <h3>Seguridad de sesión</h3>
                  <p>Protegé tu acceso y cerrá sesiones activas desde esta cuenta.</p>
                </div>
              </div>

              <div className="settings-meta-grid">
                <div className="settings-meta-card">
                  <span className="settings-meta-label">Rol actual</span>
                  <strong>{session.roles[0] ?? 'MEMBER'}</strong>
                </div>
                <div className="settings-meta-card">
                  <span className="settings-meta-label">Tenant</span>
                  <strong>{session.tenant.slug}</strong>
                </div>
                <div className="settings-meta-card">
                  <span className="settings-meta-label">Estado</span>
                  <strong>{session.tenant.isActive ? 'Activo' : 'Inactivo'}</strong>
                </div>
              </div>

              <form action={logoutAllSessionsAction}>
                <button className="button-danger" type="submit">
                  Cerrar todas las sesiones
                </button>
              </form>
            </div>
          </div>
        </article>

        <aside className="panel settings-side-panel">
          <div className="panel-head">
            <h2 className="panel-title">Resumen de la organización</h2>
          </div>

          <div className="settings-card-stack">
            <div className="settings-surface">
              <div className="settings-surface-head">
                <div>
                  <h3>Estado del plan</h3>
                  <p>Una vista rápida de la capacidad disponible hoy.</p>
                </div>
                <span className="badge">{currentPlan}</span>
              </div>

              <dl className="detail-list settings-detail-list">
                <div>
                  <dt>Máximo de Vaults</dt>
                  <dd>{maxVaults ?? 'Ilimitado'}</dd>
                </div>
                <div>
                  <dt>Máximo de usuarios</dt>
                  <dd>{maxUsers ?? 'Ilimitado'}</dd>
                </div>
                <div>
                  <dt>Notary mensual</dt>
                  <dd>{monthlyNotaryRequests ?? 'Ilimitado'}</dd>
                </div>
                <div>
                  <dt>Zero Trust</dt>
                  <dd>{session.tenant.ztPoliciesEnabled ? 'Habilitado' : 'Deshabilitado'}</dd>
                </div>
              </dl>

              <Link className="button-secondary" href="/app/billing">
                Ver plan y facturación
              </Link>
            </div>

            <div className="settings-surface">
              <div className="settings-surface-head">
                <div>
                  <h3>Identificadores</h3>
                  <p>Información útil para soporte o integraciones internas.</p>
                </div>
              </div>

              <dl className="detail-list settings-detail-list">
                <div>
                  <dt>Tenant ID</dt>
                  <dd>{session.tenant.id}</dd>
                </div>
                <div>
                  <dt>User ID</dt>
                  <dd>{session.user.id}</dd>
                </div>
              </dl>
            </div>
          </div>
        </aside>
      </section>

      <section className="panel">
        <div className="panel-head">
          <h2 className="panel-title">Configuración del tenant</h2>
          <span className="badge">{isOwner ? 'Editable' : 'Solo lectura'}</span>
        </div>

        {isOwner ? (
          <form action={updateTenantSettingsAction} className="stack" method="post">
            <div className="grid-2">
              <div className="field">
                <label htmlFor="tenantName">Nombre de la organización</label>
                <input
                  className="input"
                  defaultValue={session.tenant.name}
                  id="tenantName"
                  name="name"
                  required
                />
              </div>
              <div className="field">
                <label htmlFor="tenantSlug">Slug</label>
                <input
                  className="input"
                  defaultValue={session.tenant.slug}
                  id="tenantSlug"
                  name="slug"
                  required
                />
              </div>
            </div>

            <div className="grid-2">
              <div className="field">
                <label>Plan y suscripción</label>
                <div className="empty-card settings-inline-card">
                  <strong>{currentPlan}</strong>
                  <p className="muted">
                    Los límites, módulos y capacidades vienen definidos por el plan activo y se administran desde Facturación.
                  </p>
                  <Link className="button-secondary" href="/app/billing">
                    Abrir Facturación
                  </Link>
                </div>
              </div>
              <div className="field">
                <label>Capacidad incluida</label>
                <div className="settings-meta-grid settings-meta-grid-compact">
                  <div className="settings-meta-card">
                    <span className="settings-meta-label">Vaults</span>
                    <strong>{maxVaults ?? 'Ilimitado'}</strong>
                  </div>
                  <div className="settings-meta-card">
                    <span className="settings-meta-label">Usuarios</span>
                    <strong>{maxUsers ?? 'Ilimitado'}</strong>
                  </div>
                  <div className="settings-meta-card">
                    <span className="settings-meta-label">Notary</span>
                    <strong>{monthlyNotaryRequests ?? 'Ilimitado'}</strong>
                  </div>
                </div>
              </div>
            </div>

            <div className="settings-surface">
              <div className="settings-surface-head">
                <div>
                  <h3>Modo interno</h3>
                  <p>
                    Exime al tenant de billing y deja libres los cupos de integraciones API.
                  </p>
                </div>
                <span className={session.tenant.billingBypass ? 'status-badge' : 'badge'}>
                  {session.tenant.billingBypass ? 'Activo' : 'Inactivo'}
                </span>
              </div>

              <label className="toggle-card">
                <input
                  defaultChecked={session.tenant.billingBypass === true}
                  name="billingBypass"
                  type="checkbox"
                />
                <span>Habilitar billing bypass para este tenant</span>
                <small className="muted">
                  Mantiene acceso libre a APIs y evita downgrade automático por impago.
                </small>
              </label>
            </div>

            <div className="settings-meta-grid">
              <div className="settings-meta-card">
                <span className="settings-meta-label">Vault</span>
                <strong>{session.tenant.vaultsEnabled ? 'Habilitado' : 'Deshabilitado'}</strong>
              </div>
              <div className="settings-meta-card">
                <span className="settings-meta-label">Zero Trust</span>
                <strong>
                  {session.tenant.ztPoliciesEnabled ? 'Habilitado' : 'Deshabilitado'}
                </strong>
              </div>
              <div className="settings-meta-card">
                <span className="settings-meta-label">Estado</span>
                <strong>{session.tenant.isActive ? 'Activo' : 'Inactivo'}</strong>
              </div>
            </div>

            <div className="settings-toggle-grid settings-toggle-grid-single">
              <label className="toggle-card">
                <input
                  defaultChecked={session.tenant.isActive}
                  name="isActive"
                  type="checkbox"
                />
                <span>Organización activa</span>
              </label>
            </div>

            <p className="hint">
              Desde esta vista podés editar el nombre, el slug y el estado general del tenant. Los límites y módulos del plan se controlan desde Facturación.
            </p>

            <button className="button" type="submit">
              Guardar configuración
            </button>
          </form>
        ) : (
          <div className="empty-card">
            <strong>Solo OWNER puede editar esta sección.</strong>
            <p className="muted">
              Si necesitás un cambio de nombre o disponibilidad general, pedile a una cuenta OWNER que lo haga desde esta vista. Los cambios de plan se gestionan desde Facturación.
            </p>
          </div>
        )}
      </section>

      <section className="panel">
        <div className="panel-head">
          <h2 className="panel-title">Passkeys</h2>
          <span className="badge">WebAuthn</span>
        </div>
        <PasskeysPanel />
      </section>
    </div>
  );
}
