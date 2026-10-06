import { PageHeader } from '@/components/page-header';
import * as authClient from '@/lib/server/auth-client';
import { requireSession, withSessionToken } from '@/lib/server/session';

export default async function OrganizationsPage() {
  await requireSession();

  const organizations = await withSessionToken(async (token) => {
    const memberships = await authClient.listOrganizations(token);
    const tenantLists = await Promise.all(
      memberships.map((membership) =>
        authClient.listOrganizationTenants(token, membership.organizationId),
      ),
    );

    return memberships.map((membership, index) => ({
      ...membership,
      tenants: tenantLists[index],
    }));
  });

  return (
    <div className="page-shell">
      <PageHeader
        eyebrow="Control plane / Organizaciones"
        title="Organizaciones"
        description="Consultá las organizaciones a las que pertenecés y los tenants vinculados a cada una."
      />

      <section className="panel">
        <p className="muted">
          La provisión automatizada de organizaciones SaaS se realiza desde el backend confiable de tu producto.
          Esta consola solo muestra los recursos existentes y no expone credenciales de integración.
        </p>
      </section>

      {organizations.length ? (
        <section className="stack">
          {organizations.map((membership) => (
            <article className="panel" key={membership.organizationId}>
              <div className="panel-head">
                <div>
                  <h2 className="panel-title">{membership.organization.name}</h2>
                  <p className="muted">{membership.organization.slug}</p>
                </div>
                <span className="status-badge">{membership.role}</span>
              </div>

              <div className="table-shell">
                <table>
                  <thead>
                    <tr>
                      <th>Tenant</th>
                      <th>Slug</th>
                      <th>Estado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {membership.tenants.length ? (
                      membership.tenants.map(({ tenant }) => (
                        <tr key={tenant.id}>
                          <td>{tenant.name}</td>
                          <td>{tenant.slug}</td>
                          <td>
                            <span className={tenant.isActive ? 'status-badge' : 'badge'}>
                              {tenant.isActive ? 'Activo' : 'Inactivo'}
                            </span>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={3}>Todavía no hay tenants vinculados.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </article>
          ))}
        </section>
      ) : (
        <section className="empty-card">
          <h2 className="panel-title">Todavía no pertenecés a una organización</h2>
          <p className="muted">
            Cuando una organización te agregue y tengas acceso a un tenant, aparecerá en esta vista.
          </p>
        </section>
      )}
    </div>
  );
}
