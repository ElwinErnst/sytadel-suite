import { PageHeader } from '@/components/page-header';
import { getCapabilities } from '@/lib/server/capabilities';
import { ApiError } from '@/lib/server/http';
import {
  getServerAccessTokenOrRedirect,
  requireOperationalSession,
} from '@/lib/server/session';
import * as ztPolicyClient from '@/lib/server/zt-policy-client';
import {
  EMPTY_POLICY_SET,
  type TenantPolicyVersion,
} from '@/lib/server/types/policy.type';
import { PolicyEditor } from '@/features/zero-trust/policy-editor';

function formatDate(iso: string | null): string {
  if (!iso) return '—';
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleString();
}

/** A published policy is expected to be absent (404) for a fresh tenant; any
 * other failure is a real error and must surface, not masquerade as "empty". */
async function loadPublished(
  accessToken: string,
  tenantId: string,
): Promise<TenantPolicyVersion | null> {
  try {
    return await ztPolicyClient.getPublishedPolicy(accessToken, tenantId);
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) return null;
    throw error;
  }
}

export default async function ZeroTrustPage() {
  const session = await requireOperationalSession();
  const accessToken = await getServerAccessTokenOrRedirect();
  const capabilities = getCapabilities(session);

  const canEdit =
    session.roles.includes('OWNER') || session.roles.includes('ADMIN');

  if (!capabilities.ztPoliciesEnabled) {
    return (
      <div className="page-shell">
        <PageHeader
          eyebrow="Zero Trust / Políticas"
          title="Zero Trust"
          description="Definí qué actor puede llamar a qué servicio, y auditá cada cambio de política del tenant."
        />
        <div className="info-banner">
          Las políticas Zero Trust no están habilitadas en el plan actual de tu
          organización. Activá el módulo desde Facturación para configurarlas.
        </div>
      </div>
    );
  }

  // Policy admin is OWNER/ADMIN-only end to end: auth-api forbids MEMBER from
  // even reading the policy, so there is no partial/read-only view to show.
  if (!canEdit) {
    return (
      <div className="page-shell">
        <PageHeader
          eyebrow="Zero Trust / Políticas"
          title="Zero Trust"
          description="Definí qué actor puede llamar a qué servicio, y auditá cada cambio de política del tenant."
        />
        <div className="info-banner">
          Solo una cuenta OWNER o ADMIN puede ver y administrar las políticas
          Zero Trust del tenant.
        </div>
      </div>
    );
  }

  const [published, versions] = await Promise.all([
    loadPublished(accessToken, session.tenant.id),
    ztPolicyClient
      .listPolicyVersions(accessToken, session.tenant.id)
      .catch(() => [] as TenantPolicyVersion[]),
  ]);

  const initialPolicy = published?.policySet ?? EMPTY_POLICY_SET;

  return (
    <div className="page-shell">
      <PageHeader
        eyebrow="Zero Trust / Políticas"
        title="Zero Trust"
        description="Definí qué actor puede llamar a qué servicio, y auditá cada cambio de política del tenant."
      />

      <section className="panel">
        <h3>Política vigente</h3>
        <p className="section-copy">
          La versión publicada que el gateway Zero Trust lee y aplica.
        </p>
        {published ? (
          <div
            style={{
              display: 'grid',
              gap: 12,
              gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
              marginTop: 12,
            }}
          >
            <div>
              <div className="muted" style={{ fontSize: 12 }}>
                Versión publicada
              </div>
              <strong style={{ fontSize: 22 }}>v{published.version}</strong>
            </div>
            <div>
              <div className="muted" style={{ fontSize: 12 }}>
                Reglas
              </div>
              <strong style={{ fontSize: 22 }}>
                {published.policySet.rules.length}
              </strong>
            </div>
            <div>
              <div className="muted" style={{ fontSize: 12 }}>
                Acción por defecto
              </div>
              <strong style={{ fontSize: 22 }}>
                {published.policySet.default}
              </strong>
            </div>
          </div>
        ) : (
          <p className="muted" style={{ marginTop: 12 }}>
            Todavía no hay política publicada para este tenant. Con la acción por
            defecto en “Denegar”, el gateway rechaza todo hasta la primera
            publicación.
          </p>
        )}
      </section>

      <section className="panel">
        <h3>Política del tenant</h3>
        <p className="section-copy">
          Cada regla decide si un actor puede llamar a un servicio. Al publicar
          se crea una nueva versión y el gateway la toma automáticamente.
        </p>
        <div style={{ marginTop: 16 }}>
          <PolicyEditor initialPolicy={initialPolicy} canEdit={canEdit} />
        </div>
      </section>

      <section className="panel">
        <h3>Historial de versiones</h3>
        <p className="section-copy">
          Quién publicó cada versión y cuándo — la auditoría de cambios de
          configuración.
        </p>
        {versions.length === 0 ? (
          <p className="muted" style={{ marginTop: 12 }}>
            Sin versiones todavía.
          </p>
        ) : (
          <ul
            className="stack-sm"
            style={{ listStyle: 'none', padding: 0, marginTop: 12 }}
          >
            {versions.map((version) => (
              <li
                key={version.id}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  gap: 12,
                  padding: '10px 12px',
                  border: '1px solid rgba(255,255,255,0.08)',
                  borderRadius: 10,
                }}
              >
                <div>
                  <strong>Versión {version.version}</strong>
                  <div className="muted" style={{ fontSize: 12 }}>
                    {version.policySet?.rules?.length ?? 0} reglas · por defecto{' '}
                    {version.policySet?.default ?? '—'} ·{' '}
                    {formatDate(version.createdAt)}
                  </div>
                </div>
                <span className="badge">{version.status}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
