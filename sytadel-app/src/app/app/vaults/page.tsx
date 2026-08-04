import { PageHeader } from '@/components/page-header';
import { createVaultAction, deleteVaultAction } from '@/features/vault/actions';
import { getCapabilities } from '@/lib/server/capabilities';
import { getServerAccessTokenOrRedirect, requireOperationalSession } from '@/lib/server/session';
import * as vaultClient from '@/lib/server/vault-client';
import { formatDate } from '@/lib/ui/format';

type Props = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function VaultsPage({ searchParams }: Props) {
  const session = await requireOperationalSession();
  const accessToken = await getServerAccessTokenOrRedirect();
  const params = (await searchParams) ?? {};
  const error = typeof params.error === 'string' ? params.error : null;
  const message = typeof params.message === 'string' ? params.message : null;
  const vaults = await vaultClient.listVaults(accessToken);
  const capabilities = getCapabilities(session, { vaultCount: vaults.length });

  return (
    <div className="page-shell">
      <PageHeader
        eyebrow="Vault / Operación"
        title="Vaults del tenant"
        description="Creá y organizá espacios seguros para documentos y activos sensibles según la capacidad de tu plan."
      />

      {message ? <div className="info-banner">{message}</div> : null}
      {error ? <div className="error-banner">{error}</div> : null}
      {!capabilities.vaultFeaturesEnabled ? (
        <div className="upgrade-banner">
          <div>
            <strong>Los vaults están deshabilitados para esta sesión.</strong>
            <p className="muted">
              Revisá el estado del tenant o el plan activo para volver a habilitarlos.
            </p>
          </div>
        </div>
      ) : null}

      <section className="grid-2">
        <article className="panel">
          <div className="panel-head">
            <h2 className="panel-title">Crear vault</h2>
            <span className="badge">
              {capabilities.maxVaults == null ? 'Sin límite' : `${vaults.length}/${capabilities.maxVaults}`}
            </span>
          </div>
          {capabilities.canCreateVaultByRole ? (
            <form action={createVaultAction} className="stack" method="post">
              <div className="field">
                <label htmlFor="name">Nombre</label>
                <input
                  className="input"
                  disabled={!capabilities.vaultFeaturesEnabled}
                  id="name"
                  name="name"
                  placeholder="Operaciones legales"
                  required
                />
              </div>
              <div className="field">
                <label htmlFor="slug">Slug opcional</label>
                <input
                  className="input"
                  disabled={!capabilities.vaultFeaturesEnabled}
                  id="slug"
                  name="slug"
                  placeholder="operaciones-legales"
                />
              </div>
              <button className="button" disabled={!capabilities.canCreateVault} type="submit">
                Crear vault
              </button>
            </form>
          ) : (
            <div className="empty-card">
              <strong>Sin acceso para crear vaults.</strong>
              <p className="muted">
                Esta acción solo está disponible para perfiles con permisos de administración.
              </p>
            </div>
          )}
        </article>

        <article className="panel">
          <div className="panel-head">
            <h2 className="panel-title">Capacidad disponible</h2>
          </div>
          <div className="stack-sm">
            <span className="badge">Plan: {session.tenant.planCode ?? 'FREE'}</span>
            <span className="badge">
              {capabilities.canCreateVault
                ? 'Creación disponible'
                : capabilities.canCreateVaultByRole
                  ? 'Bloqueado por límite o configuración'
                  : 'Rol insuficiente'}
            </span>
            <span className="badge">
              {capabilities.canDeleteVault
                ? 'Eliminación disponible'
                : capabilities.canDeleteVaultByRole
                  ? 'Eliminación bloqueada'
                  : 'Eliminación no disponible para tu rol'}
            </span>
          </div>
        </article>
      </section>

      <section className="table-shell">
        <div className="panel-head" style={{ padding: '18px 18px 0' }}>
          <h2 className="panel-title">Listado de vaults</h2>
        </div>
        <table>
          <thead>
            <tr>
              <th>Nombre</th>
              <th>Slug</th>
              <th>Default</th>
              <th>Creado</th>
              <th>Acción</th>
            </tr>
          </thead>
          <tbody>
            {vaults.length ? (
              vaults.map((vault) => (
                <tr key={vault.id}>
                  <td>{vault.name}</td>
                  <td>{vault.slug}</td>
                  <td>{vault.isDefault ? 'Sí' : 'No'}</td>
                  <td>{formatDate(vault.createdAt)}</td>
                  <td>
                    {!capabilities.canDeleteVaultByRole ? (
                      <span className="action-cell">Sin acceso</span>
                    ) : vault.isDefault ? (
                      <span className="action-cell">Vault default</span>
                    ) : (
                      <form action={deleteVaultAction} method="post">
                        <input name="vaultId" type="hidden" value={vault.id} />
                        <button
                          className="button-danger"
                          disabled={!capabilities.canDeleteVault}
                          type="submit"
                        >
                          Eliminar
                        </button>
                      </form>
                    )}
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={5}>No hay vaults creados para este tenant.</td>
              </tr>
            )}
          </tbody>
        </table>
      </section>
    </div>
  );
}
