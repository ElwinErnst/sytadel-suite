import Link from 'next/link';
import { PageHeader } from '@/components/page-header';
import { deleteDocumentAction, uploadDocumentAction } from '@/features/vault/actions';
import { getCapabilities } from '@/lib/server/capabilities';
import { getServerAccessTokenOrRedirect, requireOperationalSession } from '@/lib/server/session';
import * as vaultClient from '@/lib/server/vault-client';
import { formatBytes, formatDate } from '@/lib/ui/format';

type Props = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

function getVisibleDocumentName(document: {
  originalName: string;
  storedName: string;
}) {
  const cleaned = document.storedName.replace(/^\d+_/, '').trim();
  return cleaned || document.originalName;
}

export default async function DocumentsPage({ searchParams }: Props) {
  const session = await requireOperationalSession();
  const accessToken = await getServerAccessTokenOrRedirect();
  const params = (await searchParams) ?? {};
  const selectedVaultId =
    typeof params.vaultId === 'string' ? params.vaultId : undefined;
  const verifyId = typeof params.verifyId === 'string' ? params.verifyId : undefined;
  const error = typeof params.error === 'string' ? params.error : null;
  const message = typeof params.message === 'string' ? params.message : null;

  const vaults = await vaultClient.listVaults(accessToken);
  const activeVaultId = selectedVaultId ?? vaults[0]?.id;
  const documents = activeVaultId
    ? await vaultClient.listDocuments(accessToken, activeVaultId)
    : [];
  const capabilities = getCapabilities(session, { vaultCount: vaults.length });
  const verifyResult = verifyId
    ? await vaultClient.verifyDocument(verifyId).catch(() => null)
    : null;

  return (
    <div className="page-shell">
      <PageHeader
        eyebrow="Vault / Documentos"
        title="Gestión documental segura"
        description="Elegí un Vault, cargá archivos y mantené evidencia verificable con control claro sobre cada documento."
      />

      {message ? <div className="info-banner">{message}</div> : null}
      {error ? <div className="error-banner">{error}</div> : null}
      {!capabilities.vaultFeaturesEnabled ? (
        <div className="upgrade-banner">
          <div>
            <strong>La operación documental está deshabilitada para esta sesión.</strong>
            <p className="muted">
              Podés seguir consultando lo disponible, pero algunas acciones no están habilitadas con la configuración actual.
            </p>
          </div>
        </div>
      ) : null}

      <section className="split-panels">
        <article className="panel">
          <div className="panel-head">
            <h2 className="panel-title">Seleccionar vault</h2>
          </div>
          <div className="stack-sm">
            {vaults.length ? (
              vaults.map((vault) => (
                <Link
                  key={vault.id}
                  className={vault.id === activeVaultId ? 'nav-link nav-link-active' : 'nav-link'}
                  href={`/app/documents?vaultId=${vault.id}`}
                >
                  <span>{vault.name}</span>
                  <span className="badge">{vault.slug}</span>
                </Link>
              ))
            ) : (
              <div className="empty-card">
                <strong>No hay vaults disponibles.</strong>
                <p className="muted">Primero creá un vault para empezar a subir documentos.</p>
              </div>
            )}
          </div>
        </article>

        <article className="panel">
          <div className="panel-head">
            <h2 className="panel-title">Subir documento</h2>
          </div>
          {activeVaultId ? (
            <form action={uploadDocumentAction} className="stack" method="post">
              <input name="vaultId" type="hidden" value={activeVaultId} />
              <div className="active-vault-card">
                <div className="active-vault-head">
                  <span className="active-vault-label">Vault activo</span>
                  <span className="badge">Upload target</span>
                </div>
                <div className="active-vault-name">
                  {vaults.find((vault) => vault.id === activeVaultId)?.name ?? 'Vault seleccionado'}
                </div>
                <p className="hint">
                  Los archivos se guardan en el Vault seleccionado.
                </p>
              </div>
              <div className="field">
                <label htmlFor="name">Nombre visible opcional</label>
                <input
                  className="input"
                  disabled={!capabilities.vaultFeaturesEnabled}
                  id="name"
                  name="name"
                  placeholder="Contrato Q2.pdf"
                />
              </div>
              <div className="field">
                <label htmlFor="file">Archivo</label>
                <input
                  className="file-input"
                  disabled={!capabilities.vaultFeaturesEnabled}
                  id="file"
                  name="file"
                  required
                  type="file"
                />
              </div>
              <button className="button" disabled={!capabilities.canUploadDocuments} type="submit">
                Subir documento
              </button>
            </form>
          ) : (
            <div className="empty-card">
              <strong>Elegí un vault para subir documentos.</strong>
              <p className="muted">
                La carga usa siempre el vault que tengas seleccionado en la columna de la izquierda.
              </p>
            </div>
          )}
        </article>
      </section>

      <section className="table-shell">
        <div className="panel-head" style={{ padding: '18px 18px 0' }}>
          <h2 className="panel-title">Documentos del Vault</h2>
          <span className="badge">{documents.length} archivos</span>
        </div>
        <table>
          <thead>
            <tr>
              <th>Documento</th>
              <th>Protección</th>
              <th>MIME</th>
              <th>Tamaño</th>
              <th>Creado</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {documents.length ? (
              documents.map((document) => (
                <tr key={document.id}>
                  <td>
                    <div className="stack-xs">
                      <strong>{getVisibleDocumentName(document)}</strong>
                      {getVisibleDocumentName(document) !== document.originalName ? (
                        <span className="muted">{document.originalName}</span>
                      ) : null}
                    </div>
                  </td>
                  <td>
                    <div className="stack-xs">
                      <span className="badge">{document.encAlg ?? 'N/D'}</span>
                      <span className="badge">{document.anchorStatus ?? 'PENDING'}</span>
                    </div>
                  </td>
                  <td>{document.mime}</td>
                  <td>{formatBytes(document.sizeBytes)}</td>
                  <td>{formatDate(document.createdAt)}</td>
                  <td>
                    <div className="inline-actions">
                      <Link
                        className="button-ghost"
                        href={`/app/documents?vaultId=${activeVaultId}&verifyId=${document.id}`}
                      >
                        Verificar
                      </Link>
                      {capabilities.canDownloadDocuments ? (
                        <Link
                          className="button-secondary"
                          href={`/app/documents/${document.id}/download`}
                        >
                          Descargar
                        </Link>
                      ) : (
                        <span className="button-secondary button-disabled">Descargar</span>
                      )}
                      {capabilities.canDeleteDocumentsByRole ? (
                        <form action={deleteDocumentAction} method="post">
                          <input name="documentId" type="hidden" value={document.id} />
                          <input name="vaultId" type="hidden" value={activeVaultId} />
                          <button
                            className="button-danger"
                            disabled={!capabilities.canDeleteDocuments}
                            type="submit"
                          >
                            Eliminar
                          </button>
                        </form>
                      ) : (
                        <span className="action-cell">Sin acceso</span>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={6}>No hay documentos en el vault seleccionado.</td>
              </tr>
            )}
          </tbody>
        </table>
      </section>

      {verifyId ? (
        <section className="panel">
          <div className="panel-head">
            <h2 className="panel-title">Verificación pública del documento</h2>
            <span className="badge">{verifyId}</span>
          </div>

          {verifyResult ? (
            <div className="stack">
              <div className="inline-actions">
                <span
                  className={
                    verifyResult.status === 'VALID'
                      ? 'status-badge'
                      : verifyResult.status === 'MODIFIED'
                        ? 'badge badge-danger'
                        : 'badge'
                  }
                >
                  {verifyResult.status}
                </span>
                <span className="badge">
                  {verifyResult.anchoredAt
                    ? `Anclado ${formatDate(verifyResult.anchoredAt)}`
                    : 'Sin anclaje confirmado'}
                </span>
              </div>

              <dl className="detail-list">
                <div>
                  <dt>Hash almacenado</dt>
                  <dd className="hash-block">{verifyResult.storedSha256}</dd>
                </div>
                <div>
                  <dt>Hash actual</dt>
                  <dd className="hash-block">{verifyResult.currentSha256}</dd>
                </div>
                <div>
                  <dt>Estado</dt>
                  <dd>{verifyResult.status}</dd>
                </div>
                <div>
                  <dt>Tx hash</dt>
                  <dd className="hash-block">
                    {verifyResult.anchorTxHash ?? 'Sin transaccion registrada'}
                  </dd>
                </div>
              </dl>
            </div>
          ) : (
            <div className="error-banner">
              No se pudo consultar la verificacion publica para este documento.
            </div>
          )}
        </section>
      ) : null}
    </div>
  );
}
