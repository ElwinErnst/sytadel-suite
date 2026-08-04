import { cookies } from 'next/headers';
import { PageHeader } from '@/components/page-header';
import {
  createClientAppAction,
  createMembershipAction,
  createServiceAccountAction,
  rotateServiceAccountSecretAction,
  toggleServiceAccountAction,
  updateClientAppAction,
  createUserAndMembershipAction,
  updateMembershipAction,
} from '@/features/access/actions';
import * as authClient from '@/lib/server/auth-client';
import { getCapabilities } from '@/lib/server/capabilities';
import { getServerAccessTokenOrRedirect, requireOperationalSession } from '@/lib/server/session';
import { getZeroTrustApiStatus } from '@/lib/server/zt-client';
import { formatName } from '@/lib/ui/format';

type Props = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function AccessPage({ searchParams }: Props) {
  const session = await requireOperationalSession();
  const accessToken = await getServerAccessTokenOrRedirect();
  const cookieStore = await cookies();
  const params = (await searchParams) ?? {};
  const error = typeof params.error === 'string' ? params.error : null;
  const message = typeof params.message === 'string' ? params.message : null;
  const capabilities = getCapabilities(session);
  const hasAuthApiPack = session.tenant.entitlements.features.apiAuth;
  const memberships = capabilities.canManageMembersByRole
    ? await authClient.listTenantMemberships(accessToken, session.tenant.id)
    : [];
  const clientApps = hasAuthApiPack && capabilities.canManageMembersByRole
    ? await authClient.listClientApps(accessToken, session.tenant.id)
    : [];
  const zeroTrustApiStatus =
    session.tenant.entitlements.features.apiZeroTrust && capabilities.canManageMembersByRole
      ? await getZeroTrustApiStatus(accessToken).catch(() => null)
      : null;
  const integrationSecretRaw =
    cookieStore.get('sytadel_integration_secret')?.value ?? null;
  let integrationSecret: {
    clientAppId: string;
    name: string;
    secret: string;
  } | null = null;

  if (integrationSecretRaw) {
    try {
      integrationSecret = JSON.parse(integrationSecretRaw) as {
        clientAppId: string;
        name: string;
        secret: string;
      };
    } catch {
      integrationSecret = null;
    }
  }

  return (
    <div className="page-shell">
      <PageHeader
        eyebrow="Auth / Equipo y acceso"
        title="Equipo y permisos"
        description="Administrá quién entra, con qué rol opera y cómo se mantiene el acceso dentro del tenant."
      />

      {message ? <div className="info-banner">{message}</div> : null}
      {error ? <div className="error-banner">{error}</div> : null}

      {!capabilities.canManageMembers ? (
        <div className="upgrade-banner">
          <div>
            <strong>Tu rol actual no permite administrar miembros.</strong>
            <p className="muted">Podés revisar el estado del equipo, pero no crear usuarios ni cambiar permisos.</p>
          </div>
        </div>
      ) : null}

      <section className="grid-2">
        <article className="panel">
          <div className="panel-head">
            <h2 className="panel-title">Crear usuario y asignarlo al tenant</h2>
          </div>
          {capabilities.canManageMembersByRole ? (
            <form action={createUserAndMembershipAction} className="stack" method="post">
              <input name="tenantId" type="hidden" value={session.tenant.id} />
              <div className="field">
                <label htmlFor="email">Email</label>
                <input className="input" id="email" name="email" placeholder="nuevo.usuario@test.com" required />
              </div>
              <div className="grid-2">
                <div className="field">
                  <label htmlFor="firstName">Nombre</label>
                  <input className="input" id="firstName" name="firstName" placeholder="Nuevo" />
                </div>
                <div className="field">
                  <label htmlFor="lastName">Apellido</label>
                  <input className="input" id="lastName" name="lastName" placeholder="Usuario" />
                </div>
              </div>
              <div className="field">
                <label htmlFor="password">Password inicial</label>
                <input className="input" id="password" name="password" placeholder="123456" required />
              </div>
              <div className="field">
                <label htmlFor="role">Rol</label>
                <select className="select" defaultValue="MEMBER" id="role" name="role">
                  <option value="MEMBER">MEMBER</option>
                  <option value="ADMIN">ADMIN</option>
                  <option value="OWNER">OWNER</option>
                </select>
              </div>
              <p className="hint">
                La cuenta se crea y queda incorporada al tenant actual en un solo paso.
              </p>
              <button className="button" type="submit">
                Crear usuario
              </button>
            </form>
          ) : (
            <div className="empty-card">
              <strong>Vista de solo lectura.</strong>
              <p className="muted">
                Cuando el rol actual sea ADMIN u OWNER, acá vas a poder crear memberships y reasignar roles.
              </p>
            </div>
          )}
        </article>

        <article className="panel">
          <div className="panel-head">
            <h2 className="panel-title">Vincular una cuenta existente</h2>
          </div>
          {capabilities.canManageMembersByRole ? (
            <form action={createMembershipAction} className="stack" method="post">
              <input name="tenantId" type="hidden" value={session.tenant.id} />
              <div className="field">
                <label htmlFor="userId">ID de usuario</label>
                <input className="input" id="userId" name="userId" placeholder="UUID de una cuenta existente" required />
              </div>
              <div className="field">
                <label htmlFor="existingRole">Rol</label>
                <select className="select" defaultValue="MEMBER" id="existingRole" name="role">
                  <option value="MEMBER">MEMBER</option>
                  <option value="ADMIN">ADMIN</option>
                  <option value="OWNER">OWNER</option>
                </select>
              </div>
              <p className="hint">
                Usá este formulario para sumar al tenant una cuenta que ya exista.
              </p>
              <button className="button-secondary" type="submit">
                Agregar al tenant
              </button>
            </form>
          ) : (
            <div className="stack-sm">
              <span className="badge">Rol actual: {session.roles[0]}</span>
              <span className="badge">Plan actual: {session.tenant.planCode ?? 'FREE'}</span>
              <span className="badge">
                {capabilities.canManageMembers ? 'Gestión habilitada' : 'Gestión bloqueada'}
              </span>
            </div>
          )}
        </article>
      </section>

      <section className="table-shell">
        <div className="panel-head" style={{ padding: '18px 18px 0' }}>
          <h2 className="panel-title">Accesos del tenant</h2>
        </div>
        {capabilities.canManageMembersByRole ? (
          <table>
            <thead>
              <tr>
                <th>Usuario</th>
                <th>Email</th>
                <th>Rol</th>
                <th>Activo</th>
                <th>Gestión</th>
              </tr>
            </thead>
            <tbody>
              {memberships.map((membership) => (
                <tr key={membership.id}>
                  <td>{formatName(membership.user ?? {})}</td>
                  <td>{membership.user?.email ?? membership.userId}</td>
                  <td>{membership.role}</td>
                  <td>{membership.isActive ? 'Sí' : 'No'}</td>
                  <td>
                    <form action={updateMembershipAction} className="inline-form" method="post">
                      <input name="membershipId" type="hidden" value={membership.id} />
                      <select className="select" defaultValue={membership.role} name="role">
                        <option value="MEMBER">MEMBER</option>
                        <option value="ADMIN">ADMIN</option>
                        <option value="OWNER">OWNER</option>
                      </select>
                      <label className="inline-actions">
                        <input defaultChecked={membership.isActive} name="isActive" type="checkbox" />
                        <span>{membership.isActive ? 'Activo' : 'Inactivo'}</span>
                      </label>
                      <button className="button-secondary" type="submit">
                        Guardar
                      </button>
                    </form>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div className="empty-card" style={{ margin: '18px' }}>
            <strong>Listado restringido por rol.</strong>
            <p className="muted">
              Solo los perfiles con permisos de administración pueden consultar y editar este listado.
            </p>
          </div>
        )}
      </section>

      <section className="grid-2">
        <article className="panel">
          <div className="panel-head">
            <h2 className="panel-title">Integraciones y Auth API</h2>
          </div>

          {hasAuthApiPack ? (
            <>
              <div className="stack-sm" style={{ marginBottom: 18 }}>
                <span className="badge">Auth API Pack activo</span>
                <span className="badge">Client Apps visibles por tenant</span>
                <span className="badge">Service Accounts con secreto propio</span>
                <span className="badge">
                  Cupos: {session.tenant.entitlements.limits.maxClientApps ?? 'Ilimitado'} apps cliente /{' '}
                  {session.tenant.entitlements.limits.maxServiceAccounts ?? 'Ilimitado'} cuentas por app
                </span>
              </div>

              {integrationSecret ? (
                <div className="info-banner">
                  <strong>Secret recién emitido para {integrationSecret.name}.</strong>
                  <p className="muted" style={{ marginTop: 8 }}>
                    Guardalo ahora. No se vuelve a mostrar después.
                  </p>
                  <code style={{ display: 'block', marginTop: 10, wordBreak: 'break-all' }}>
                    {integrationSecret.secret}
                  </code>
                </div>
              ) : null}

              {capabilities.canManageMembersByRole ? (
                <form action={createClientAppAction} className="stack" method="post">
                  <input name="tenantId" type="hidden" value={session.tenant.id} />
                  <div className="grid-2">
                    <div className="field">
                      <label htmlFor="clientAppName">Nombre de la Client App</label>
                      <input className="input" id="clientAppName" name="name" placeholder="Portal B2B" required />
                    </div>
                    <div className="field">
                      <label htmlFor="clientAppSlug">Slug</label>
                      <input className="input" id="clientAppSlug" name="slug" placeholder="portal-b2b" required />
                    </div>
                  </div>
                  <div className="field">
                    <label htmlFor="clientAppDescription">Descripción</label>
                    <input
                      className="input"
                      id="clientAppDescription"
                      name="description"
                      placeholder="Integración principal del portal o backend del cliente"
                    />
                  </div>
                  <button className="button" type="submit">
                    Crear Client App
                  </button>
                </form>
              ) : (
                <div className="empty-card">
                  <strong>Sin permisos para crear integraciones.</strong>
                  <p className="muted">Necesitás un rol OWNER o ADMIN para administrar credenciales técnicas.</p>
                </div>
              )}
            </>
          ) : (
            <div className="empty-card">
              <strong>Auth API Pack no habilitado.</strong>
              <p className="muted">
                Cuando el tenant active ese add-on, acá vas a administrar Client Apps, Service Accounts y credenciales
                de integración para tus aplicaciones.
              </p>
            </div>
          )}
        </article>

        <article className="panel">
          <div className="panel-head">
            <h2 className="panel-title">Client Apps del tenant</h2>
          </div>

          {!hasAuthApiPack ? (
            <div className="empty-card">
              <strong>Pack no activo.</strong>
              <p className="muted">La gestión de integraciones se habilita desde Facturación con el add-on de Auth API.</p>
            </div>
          ) : clientApps.length === 0 ? (
            <div className="empty-card">
              <strong>Todavía no hay Client Apps.</strong>
              <p className="muted">Creá la primera para representar una app externa y después emitir cuentas de servicio.</p>
            </div>
          ) : (
            <div className="stack">
              {clientApps.map((clientApp) => (
                <div className="subpanel" key={clientApp.id}>
                  <div className="panel-head">
                    <div>
                      <h3 className="panel-title" style={{ marginBottom: 6 }}>{clientApp.name}</h3>
                      <p className="muted">{clientApp.description ?? clientApp.slug}</p>
                    </div>
                    <span className="badge">{clientApp.isActive ? 'Activa' : 'Inactiva'}</span>
                  </div>

                  <div className="stack-sm" style={{ marginBottom: 14 }}>
                    <span className="badge">Slug: {clientApp.slug}</span>
                    <span className="badge">
                      {(clientApp.serviceAccounts ?? []).length} /{' '}
                      {session.tenant.entitlements.limits.maxServiceAccounts ?? 'Ilimitado'} cuentas
                    </span>
                  </div>

                  <div className="stack-sm" style={{ marginBottom: 14 }}>
                    {(clientApp.serviceAccounts ?? []).map((account) => (
                      <div className="inline-actions" key={account.id} style={{ justifyContent: 'space-between' }}>
                        <div>
                          <strong>{account.name}</strong>
                          <p className="muted">{account.secretPreview} · {account.isActive ? 'Activa' : 'Inactiva'}</p>
                        </div>
                        <span className="badge">
                          {account.lastUsedAt ? `Usada ${new Date(account.lastUsedAt).toLocaleDateString('es-AR')}` : 'Sin uso'}
                        </span>
                      </div>
                    ))}
                    {(clientApp.serviceAccounts ?? []).length === 0 ? (
                      <p className="muted">Todavía no tiene service accounts.</p>
                    ) : null}
                  </div>

                  {capabilities.canManageMembersByRole ? (
                    <>
                      <form action={updateClientAppAction} className="stack-sm" method="post">
                        <input name="tenantId" type="hidden" value={session.tenant.id} />
                        <input name="clientAppId" type="hidden" value={clientApp.id} />
                        <div className="grid-2">
                          <div className="field">
                            <label htmlFor={`client-app-name-${clientApp.id}`}>Nombre visible</label>
                            <input
                              className="input"
                              defaultValue={clientApp.name}
                              id={`client-app-name-${clientApp.id}`}
                              name="name"
                              required
                            />
                          </div>
                          <div className="field">
                            <label htmlFor={`client-app-slug-${clientApp.id}`}>Slug</label>
                            <input
                              className="input"
                              defaultValue={clientApp.slug}
                              id={`client-app-slug-${clientApp.id}`}
                              name="slug"
                              required
                            />
                          </div>
                        </div>
                        <div className="field">
                          <label htmlFor={`client-app-description-${clientApp.id}`}>Descripción</label>
                          <input
                            className="input"
                            defaultValue={clientApp.description ?? ''}
                            id={`client-app-description-${clientApp.id}`}
                            name="description"
                            placeholder="Backend, portal o integración que usa esta app"
                          />
                        </div>
                        <div className="inline-actions">
                          <button className="button-secondary" type="submit">
                            Guardar Client App
                          </button>
                          <button
                            className="button-secondary"
                            name="nextState"
                            type="submit"
                            value={clientApp.isActive ? 'deactivate' : 'activate'}
                          >
                            {clientApp.isActive ? 'Desactivar Client App' : 'Reactivar Client App'}
                          </button>
                        </div>
                      </form>

                      <form action={createServiceAccountAction} className="stack-sm" method="post">
                        <input name="tenantId" type="hidden" value={session.tenant.id} />
                        <input name="clientAppId" type="hidden" value={clientApp.id} />
                        <div className="grid-2">
                          <div className="field">
                            <label htmlFor={`service-account-name-${clientApp.id}`}>Nueva Service Account</label>
                            <input
                              className="input"
                              id={`service-account-name-${clientApp.id}`}
                              name="name"
                              placeholder="backend-prod"
                              required
                            />
                          </div>
                          <div className="field">
                            <label htmlFor={`service-account-description-${clientApp.id}`}>Descripción</label>
                            <input
                              className="input"
                              id={`service-account-description-${clientApp.id}`}
                              name="description"
                              placeholder="Cuenta usada por el backend de producción"
                            />
                          </div>
                        </div>
                        <button className="button-secondary" type="submit">
                          Emitir Service Account
                        </button>
                      </form>

                      {(clientApp.serviceAccounts ?? []).length ? (
                        <div className="stack-sm">
                          {(clientApp.serviceAccounts ?? []).map((account) => (
                            <div className="inline-actions" key={`${clientApp.id}-${account.id}-actions`}>
                              <form action={rotateServiceAccountSecretAction} method="post">
                                <input name="tenantId" type="hidden" value={session.tenant.id} />
                                <input name="serviceAccountId" type="hidden" value={account.id} />
                                <button className="button-secondary" type="submit">
                                  Rotar secreto de {account.name}
                                </button>
                              </form>
                              <form action={toggleServiceAccountAction} method="post">
                                <input name="tenantId" type="hidden" value={session.tenant.id} />
                                <input name="serviceAccountId" type="hidden" value={account.id} />
                                <input
                                  name="nextState"
                                  type="hidden"
                                  value={account.isActive ? 'deactivate' : 'activate'}
                                />
                                <button className="button-secondary" type="submit">
                                  {account.isActive ? 'Desactivar' : 'Reactivar'}
                                </button>
                              </form>
                            </div>
                          ))}
                        </div>
                      ) : null}
                    </>
                  ) : null}
                </div>
              ))}
            </div>
          )}
        </article>
      </section>

      <section className="panel">
        <div className="panel-head">
          <h2 className="panel-title">Zero Trust API</h2>
          <span className="badge">
            {session.tenant.entitlements.features.apiZeroTrust ? 'Pack activo' : 'Pack no habilitado'}
          </span>
        </div>

        {session.tenant.entitlements.features.apiZeroTrust ? (
          zeroTrustApiStatus ? (
            <div className="grid-3">
              <div className="summary-card">
                <span className="settings-meta-label">Policies expuestas</span>
                <h3 className="metric-value">{zeroTrustApiStatus.policiesRules}</h3>
              </div>
              <div className="summary-card">
                <span className="settings-meta-label">Upstreams expuestos</span>
                <h3 className="metric-value">{zeroTrustApiStatus.upstreams}</h3>
              </div>
              <div className="summary-card">
                <span className="settings-meta-label">Acceso técnico</span>
                <h3 className="metric-value">
                  {session.tenant.entitlements.features.apiAuth ? 'Listo' : 'Requiere Auth API'}
                </h3>
              </div>
            </div>
          ) : (
            <div className="empty-card">
              <strong>No se pudo leer el estado de Zero Trust API.</strong>
              <p className="muted">El pack está activo, pero el estado no respondió en esta carga.</p>
            </div>
          )
        ) : (
          <div className="empty-card">
            <strong>Zero Trust API Pack no habilitado.</strong>
            <p className="muted">
              Este add-on abre una superficie autenticada para revisar estado, policies y upstreams del tenant.
            </p>
          </div>
        )}
      </section>
    </div>
  );
}
