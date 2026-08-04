import Link from 'next/link';
import { PageHeader } from '@/components/page-header';
import {
  cancelSubscriptionAction,
  createCheckoutSessionAction,
  createPortalSessionAction,
} from '@/features/billing/actions';
import { getBillingOverview } from '@/lib/server/billing-client';
import type {
  BillingApiAddonCode,
  BillingCatalogApiAddon,
  BillingCatalogOffer,
  BillingIndustryCode,
  BillingSubscription,
  BillingUsageEvent,
} from '@/lib/server/types';
import { requireSession, withSessionToken } from '@/lib/server/session';

type Props = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

function formatMoney(amountCents: number | null, currency = 'USD') {
  if (amountCents == null) return 'A medida';

  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(amountCents / 100);
}

function formatDate(value: string | null) {
  if (!value) return 'No disponible';

  return new Intl.DateTimeFormat('es-AR', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}

function readIndustryLabel(code: BillingIndustryCode | null | undefined) {
  const labels: Record<BillingIndustryCode, string> = {
    GENERAL: 'General',
    FINTECH: 'Fintech',
    GOVTECH: 'GovTech',
    HEALTHTECH: 'HealthTech',
    LEGALTECH: 'LegalTech',
  };

  if (!code) return 'General';
  return labels[code];
}

function readIndustryDescription(code: BillingIndustryCode) {
  const labels: Record<BillingIndustryCode, string> = {
    GENERAL: 'Para equipos que necesitan ordenar acceso, documentación y operación desde una sola base.',
    FINTECH: 'Para operaciones financieras, onboarding sensible y flujos con mayor exigencia de control.',
    GOVTECH: 'Para expedientes, evidencia y circuitos con trazabilidad en entornos públicos.',
    HEALTHTECH: 'Para entornos clínicos o sensibles que requieren más resguardo y control operativo.',
    LEGALTECH: 'Para contratos, evidencia documental y operaciones con fuerte exigencia regulatoria.',
  };

  return labels[code];
}

function readTierLabel(code: BillingSubscription['basePlan'] | null | undefined) {
  const labels: Record<string, string> = {
    BASE: 'Base',
    GROWTH: 'Growth',
    BUSINESS: 'Business',
    CUSTOM: 'Custom',
  };

  if (!code) return 'Free';
  return labels[code] ?? code;
}

function readBillingStatusLabel(status: BillingSubscription['status'] | null | undefined) {
  const labels: Record<NonNullable<BillingSubscription['status']>, string> = {
    PENDING: 'Pendiente',
    ACTIVE: 'Activa',
    PAST_DUE: 'Pago pendiente',
    CANCELED: 'Cancelada',
  };

  if (!status) return 'Sin suscripción paga';
  return labels[status] ?? status;
}

function readProviderLabel(provider: string) {
  if (provider === 'stripe') return 'Stripe';
  if (provider === 'mercadopago') return 'Mercado Pago';
  if (provider === 'mock') return 'Simulación';
  return provider;
}

function readZtModeLabel(mode: BillingCatalogOffer['limits']['ztMode']) {
  const labels: Record<BillingCatalogOffer['limits']['ztMode'], string> = {
    basic: 'Base',
    advanced: 'Advanced',
    custom: 'Custom',
  };

  return labels[mode] ?? mode;
}

function readOfferDescription(offer: BillingCatalogOffer) {
  const tier = readTierLabel(offer.tier);
  const industry = readIndustryLabel(offer.industry);

  if (offer.tier === 'CUSTOM') {
    return `${tier} para organizaciones ${industry} con requerimientos especiales, límites a medida o necesidades de implementación particular.`;
  }

  return `${tier} para organizaciones ${industry} que necesitan una operación más ordenada, más capacidad y mejor control sobre acceso, Vault y Notary.`;
}

function readSearchString(
  params: Record<string, string | string[] | undefined>,
  key: string,
) {
  return typeof params[key] === 'string' ? params[key] : null;
}

function createSalesMailto(tenantName: string, industry: string, tier: string) {
  const subject = encodeURIComponent(`Consulta comercial sobre ${tier} para ${tenantName}`);
  const body = encodeURIComponent(
    [
      'Hola equipo de Sytadel,',
      '',
      'Quiero recibir más información comercial sobre este plan.',
      '',
      `Organización: ${tenantName}`,
      `Industria: ${industry}`,
      `Plan de interés: ${tier}`,
      '',
      'Gracias.',
    ].join('\n'),
  );

  return `mailto:sytadel.labs@gmail.com?subject=${subject}&body=${body}`;
}

function createApiSalesMailto(tenantName: string, packageName: string) {
  const subject = encodeURIComponent(`Consulta por ${packageName} para ${tenantName}`);
  const body = encodeURIComponent(
    [
      'Hola equipo de Sytadel,',
      '',
      'Quiero recibir más información sobre este paquete de API.',
      '',
      `Organización: ${tenantName}`,
      `Paquete API: ${packageName}`,
      '',
      'Gracias.',
    ].join('\n'),
  );

  return `mailto:sytadel.labs@gmail.com?subject=${subject}&body=${body}`;
}

function getTierRank(code: string | null | undefined) {
  const ranking: Record<string, number> = {
    FREE: 0,
    BASE: 1,
    GROWTH: 2,
    BUSINESS: 3,
    CUSTOM: 4,
  };

  if (!code) return 0;
  return ranking[code] ?? 0;
}

function readApiAddonLabel(code: BillingApiAddonCode) {
  const labels: Record<BillingApiAddonCode, string> = {
    AUTH_API: 'Auth API Pack',
    VAULT_API: 'Vault API Pack',
    ZERO_TRUST_API: 'Zero Trust API Pack',
  };

  return labels[code];
}

function readApiAddonDependencyLabel(code: BillingApiAddonCode) {
  if (code === 'AUTH_API') return 'Base del modelo de integraciones';
  return 'Requiere Auth API Pack';
}

function readUsageMetricLabel(metric: string) {
  const labels: Record<string, string> = {
    service_account_tokens_issued: 'Tokens técnicos emitidos',
    vault_api_requests: 'Requests a Vault API',
    vault_api_upload_requests: 'Uploads a Vault API',
    vault_api_download_requests: 'Downloads desde Vault API',
    zt_api_requests: 'Requests protegidos',
    zt_api_status_requests: 'Consultas de estado',
    zt_api_policies_requests: 'Consultas de policies',
    zt_api_upstreams_requests: 'Consultas de upstreams',
  };

  return labels[metric] ?? metric;
}

function readUsageSourceLabel(source: string) {
  const labels: Record<string, string> = {
    'auth-api': 'Auth',
    'zerotrust-api': 'Zero Trust',
    'vault-api': 'Vault',
  };

  return labels[source] ?? source;
}

function readUsageAddonLabel(code: BillingApiAddonCode) {
  return readApiAddonLabel(code);
}

function formatUsageWindow(value: string | null) {
  if (!value) return 'Todavía no hay una ventana activa de consumo';

  return `Ventana actual desde ${formatDate(value)}`;
}

function groupUsageEventsByAddon(events: BillingUsageEvent[]) {
  return events.reduce<Record<string, BillingUsageEvent[]>>((acc, event) => {
    const bucket = (acc[event.addonCode] ??= []);
    bucket.push(event);
    return acc;
  }, {});
}

function findApiPackageDetails(
  addonCode: BillingApiAddonCode,
  apiPackages: BillingCatalogApiAddon[],
) {
  return apiPackages.find((pack) => pack.code === addonCode) ?? null;
}

function formatCompactNumber(value: number) {
  return new Intl.NumberFormat('es-AR').format(value);
}

function formatMoneyWithCents(amountCents: number, currency = 'USD') {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amountCents / 100);
}

function getUsageAlertTone(percent: number) {
  if (percent >= 100) return 'danger';
  if (percent >= 80) return 'warning';
  return 'ok';
}

function readUsageAlertLabel(percent: number) {
  if (percent >= 100) return 'Límite alcanzado';
  if (percent >= 80) return 'Cerca del límite';
  return 'Consumo saludable';
}

export default async function BillingPage({ searchParams }: Props) {
  const session = await requireSession();
  const params = (await searchParams) ?? {};
  const error = readSearchString(params, 'error');
  const billingState = readSearchString(params, 'billing');
  const subscriptionId = readSearchString(params, 'subscriptionId');
  const selectedIndustry =
    (readSearchString(params, 'industry') as BillingIndustryCode | null) ??
    (session.tenant.planCode === 'FREE'
      ? 'GENERAL'
      : (null as BillingIndustryCode | null));
  const isOwner = session.roles.includes('OWNER');

  const overview = await withSessionToken((token) => getBillingOverview(token));
  const activeSubscription = overview.subscription;
  const currentTierLabel = readTierLabel(activeSubscription?.basePlan);
  const currentIndustryLabel = readIndustryLabel(activeSubscription?.industryPackage);
  const currentIndustry =
    selectedIndustry ?? activeSubscription?.industryPackage ?? 'GENERAL';
  const offers = overview.catalog.offers.filter((offer) => offer.industry === currentIndustry);
  const currentTierCode = activeSubscription?.basePlan ?? session.tenant.planCode ?? 'FREE';
  const currentTierRank = getTierRank(currentTierCode);
  const apiPackages = overview.catalog.apiAddons;
  const usageEventsByAddon = groupUsageEventsByAddon(overview.usage.recentEvents);

  return (
    <div className="page-shell">
      <PageHeader
        eyebrow="Facturación / Suscripción del tenant"
        title="Plan y facturación"
        description="Elegí el tipo de organización y compará los planes disponibles con sus límites reales."
      >
        <span className="badge">{isOwner ? 'Administración habilitada' : 'Solo lectura'}</span>
      </PageHeader>

      {billingState === 'activated' || billingState === 'success' ? (
        <div className="info-banner">
          La suscripción se activó correctamente.
          {subscriptionId ? ` Ref: ${subscriptionId}` : ''}
        </div>
      ) : null}
      {billingState === 'canceled' ? (
        <div className="info-banner">La compra fue cancelada antes de completar el pago.</div>
      ) : null}
      {billingState === 'pending' ? (
        <div className="info-banner">
          El pago quedó pendiente de confirmación. Refrescá en unos minutos para ver el estado actualizado.
          {subscriptionId ? ` Ref: ${subscriptionId}` : ''}
        </div>
      ) : null}
      {billingState === 'cancel_scheduled' ? (
        <div className="info-banner">
          La baja quedó programada para el próximo cierre de facturación. Hasta entonces, el plan actual sigue activo.
        </div>
      ) : null}
      {error ? <div className="error-banner">{error}</div> : null}

      <section className="grid-2">
        <article className="panel">
          <div className="panel-head">
            <h2 className="panel-title">Plan actual</h2>
            <span className="badge">{currentTierLabel}</span>
          </div>

          <dl className="detail-list">
            <div>
              <dt>Organización</dt>
              <dd>{session.tenant.name}</dd>
            </div>
            <div>
              <dt>Industria</dt>
              <dd>{currentIndustryLabel}</dd>
            </div>
            <div>
              <dt>Estado</dt>
              <dd>{readBillingStatusLabel(activeSubscription?.status)}</dd>
            </div>
            <div>
              <dt>Proveedor</dt>
              <dd>{readProviderLabel(overview.provider)}</dd>
            </div>
            <div>
              <dt>Usuarios</dt>
              <dd>{activeSubscription?.seats ?? 1}</dd>
            </div>
            <div>
              <dt>Monto actual</dt>
              <dd>
                {activeSubscription
                  ? `${formatMoney(activeSubscription.amountCents, activeSubscription.currency)} / ${activeSubscription.billingCycle === 'yearly' ? 'año' : 'mes'}`
                  : 'Free'}
              </dd>
            </div>
            <div>
              <dt>Add-ons API</dt>
              <dd>
                {activeSubscription?.apiAddons?.length
                  ? activeSubscription.apiAddons.map(readApiAddonLabel).join(', ')
                  : 'Sin add-ons'}
              </dd>
            </div>
            <div>
              <dt>Fin de prueba</dt>
              <dd>{formatDate(activeSubscription?.trialEndsAt ?? null)}</dd>
            </div>
            <div>
              <dt>Fin del período actual</dt>
              <dd>{formatDate(activeSubscription?.currentPeriodEndsAt ?? null)}</dd>
            </div>
            <div>
              <dt>Baja programada</dt>
              <dd>{activeSubscription?.cancelAtPeriodEnd ? 'Sí' : 'No'}</dd>
            </div>
            <div>
              <dt>Eliminación de excedentes</dt>
              <dd>{formatDate(activeSubscription?.dataDeletionDueAt ?? null)}</dd>
            </div>
          </dl>
        </article>

        <article className="panel">
          <div className="panel-head">
            <h2 className="panel-title">Datos de facturación</h2>
            <span className="badge">{isOwner ? 'Editable en pago' : 'Informativo'}</span>
          </div>

          <dl className="detail-list">
            <div>
              <dt>Email de facturación</dt>
              <dd>{overview.customer?.billingEmail ?? session.user.email}</dd>
            </div>
            <div>
              <dt>Organización</dt>
              <dd>{overview.customer?.companyName ?? session.tenant.name}</dd>
            </div>
            <div>
              <dt>Máximo de Vaults</dt>
              <dd>{session.tenant.entitlements.limits.maxVaults ?? 'Ilimitado'}</dd>
            </div>
            <div>
              <dt>Notary mensual</dt>
              <dd>
                {session.tenant.entitlements.limits.monthlyNotaryRequests ?? 'Ilimitado'}
              </dd>
            </div>
          </dl>

          {isOwner && overview.provider === 'stripe' && overview.customer?.providerCustomerId ? (
            <form action={createPortalSessionAction}>
              <button className="button-secondary" type="submit">
                Administrar facturación
              </button>
            </form>
          ) : null}

          {isOwner && activeSubscription?.status === 'ACTIVE' && !activeSubscription.cancelAtPeriodEnd ? (
            <form action={cancelSubscriptionAction}>
              <button className="button-secondary" type="submit">
                Dar de baja al próximo ciclo
              </button>
            </form>
          ) : null}
        </article>
      </section>

      <section className="panel">
        <div className="panel-head">
          <h2 className="panel-title">Últimos cierres de período</h2>
          <span className="badge">Historial</span>
        </div>

        {overview.recentPeriodClosures.length ? (
          <div className="grid-2">
            {overview.recentPeriodClosures.map((period) => (
              <article className="subpanel stack-sm" key={period.id}>
                <div className="panel-head">
                  <h3 className="panel-title">
                    Cierre del {new Intl.DateTimeFormat('es-AR', { dateStyle: 'medium' }).format(new Date(period.periodEndedAt))}
                  </h3>
                  <span className="status-badge">
                    {formatMoneyWithCents(period.totalAmountCents, period.currency)}
                  </span>
                </div>

                <dl className="detail-list">
                  <div>
                    <dt>Período</dt>
                    <dd>
                      {formatDate(period.periodStartedAt)} a {formatDate(period.periodEndedAt)}
                    </dd>
                  </div>
                  <div>
                    <dt>Base</dt>
                    <dd>{formatMoneyWithCents(period.baseAmountCents, period.currency)}</dd>
                  </div>
                  <div>
                    <dt>Add-ons</dt>
                    <dd>{formatMoneyWithCents(period.addonAmountCents, period.currency)}</dd>
                  </div>
                  <div>
                    <dt>Exceso</dt>
                    <dd>{formatMoneyWithCents(period.overageAmountCents, period.currency)}</dd>
                  </div>
                </dl>
              </article>
            ))}
          </div>
        ) : (
          <div className="empty-card">
            <strong>Todavía no hay cierres persistidos para esta suscripción.</strong>
            <p className="muted">
              Cuando se cierre un período de facturación, acá vas a ver el total base, add-ons y exceso consolidado.
            </p>
          </div>
        )}
      </section>

      <section className="panel">
        <div className="panel-head">
          <h2 className="panel-title">Uso actual de API packs</h2>
          <span className="badge">
            {formatUsageWindow(overview.usage.windowStartedAt)}
          </span>
        </div>

        {activeSubscription?.apiAddons?.length ? (
          <div className="grid-3">
            {activeSubscription.apiAddons.map((addonCode) => {
              const totals = overview.usage.totals[addonCode] ?? {};
              const metrics = Object.entries(totals);
              const recentEvents = usageEventsByAddon[addonCode] ?? [];
              const packageDetails = findApiPackageDetails(addonCode, apiPackages);
              const overage = overview.usage.overages[addonCode] ?? null;
              const trackedUsage = packageDetails?.usageLimits.map((limit) => {
                const used = totals[limit.metric] ?? 0;
                const percent = limit.included > 0 ? Math.min((used / limit.included) * 100, 100) : 0;
                return {
                  ...limit,
                  used,
                  percent,
                  tone: getUsageAlertTone(percent),
                  alertLabel: readUsageAlertLabel(percent),
                };
              }) ?? [];

              return (
                <article className="subpanel stack" key={addonCode}>
                  <div className="panel-head">
                    <h3 className="panel-title">{readUsageAddonLabel(addonCode)}</h3>
                    <span className="status-badge">Activo</span>
                  </div>

                  {trackedUsage.length ? (
                    <div className="stack-sm">
                      <span className="settings-meta-label">Cobertura incluida</span>
                      <div className="usage-limit-list">
                        {trackedUsage.map((limit) => (
                          <div className="usage-limit-card" key={limit.metric}>
                            <div className="usage-limit-head">
                              <strong>{limit.label}</strong>
                              <span className={`usage-alert usage-alert-${limit.tone}`}>
                                {limit.alertLabel}
                              </span>
                            </div>
                            <div className="usage-limit-meta">
                              <span>{formatCompactNumber(limit.used)} usados</span>
                              <span>
                                {formatCompactNumber(limit.included)} {limit.unit}
                              </span>
                            </div>
                            <div
                              aria-hidden="true"
                              className="usage-progress"
                            >
                              <span
                                className={`usage-progress-bar usage-progress-bar-${limit.tone}`}
                                style={{ width: `${Math.max(limit.percent, 4)}%` }}
                              />
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : null}

                  {overage && overage.estimatedExtraCents > 0 ? (
                    <div className="usage-overage-card">
                      <div className="usage-overage-head">
                        <strong>Estimado adicional actual</strong>
                        <span className="usage-alert usage-alert-danger">
                          {formatMoneyWithCents(overage.estimatedExtraCents)}
                        </span>
                      </div>
                      <div className="usage-overage-list">
                        {overage.metrics
                          .filter((metric) => metric.estimatedExtraCents > 0)
                          .map((metric) => (
                            <div className="usage-overage-row" key={metric.metric}>
                              <span>{metric.label}</span>
                              <span>
                                +{formatCompactNumber(metric.excess)} ·{' '}
                                {formatMoneyWithCents(metric.estimatedExtraCents)}
                              </span>
                            </div>
                          ))}
                      </div>
                    </div>
                  ) : null}

                  {metrics.length ? (
                    <dl className="usage-metric-list">
                      {metrics.map(([metric, quantity]) => (
                        <div key={metric}>
                          <dt>{readUsageMetricLabel(metric)}</dt>
                          <dd>{quantity}</dd>
                        </div>
                      ))}
                    </dl>
                  ) : (
                    <p className="muted">
                      Todavía no registramos consumo para este paquete en la ventana actual.
                    </p>
                  )}

                  {packageDetails?.features?.length ? (
                    <div className="stack-sm">
                      <span className="settings-meta-label">Incluye</span>
                      <ul className="usage-feature-list">
                        {packageDetails.features.map((feature) => (
                          <li key={feature}>{feature}</li>
                        ))}
                      </ul>
                    </div>
                  ) : null}

                  {recentEvents.length ? (
                    <div className="stack-sm">
                      <span className="settings-meta-label">Actividad reciente</span>
                      <div className="usage-event-list">
                        {recentEvents.slice(0, 3).map((event) => (
                          <div className="usage-event-row" key={event.id}>
                            <strong>{readUsageMetricLabel(event.metric)}</strong>
                            <span className="muted">
                              {event.quantity} · {readUsageSourceLabel(event.sourceService)} · {formatDate(event.createdAt)}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : null}
                </article>
              );
            })}
          </div>
        ) : (
          <div className="empty-card">
            <strong>Tu tenant todavía no tiene paquetes de API activos.</strong>
            <p className="muted">
              Cuando actives add-ons de integración, acá vas a ver su consumo y la actividad reciente por paquete.
            </p>
          </div>
        )}
      </section>

      <section className="panel">
        <div className="panel-head">
          <h2 className="panel-title">Elegí el tipo de organización</h2>
          <span className="badge">{readIndustryLabel(currentIndustry)}</span>
        </div>

        <div className="grid-3">
          {overview.catalog.industries.map((industry) => (
            <Link
              key={industry.code}
              className={industry.code === currentIndustry ? 'nav-link nav-link-active' : 'nav-link'}
              href={`/app/billing?industry=${industry.code}`}
            >
              <span>{industry.name}</span>
              <span className="muted">{readIndustryDescription(industry.code)}</span>
            </Link>
          ))}
        </div>
      </section>

      <section className="panel">
        <div className="panel-head">
          <h2 className="panel-title">Planes disponibles</h2>
          <span className="badge">{readIndustryLabel(currentIndustry)}</span>
        </div>

        {!isOwner ? (
          <div className="empty-card">
            <strong>Solo la cuenta administradora puede actualizar el plan.</strong>
            <p className="muted">
              Si necesitás cambiar la suscripción, pedile al responsable del tenant que lo haga desde esta sección.
            </p>
          </div>
        ) : (
          <div className="grid-2">
            {offers.map((offer) => (
              <article className="panel" key={`${offer.industry}-${offer.tier}`}>
                <div className="panel-head">
                  <h3 className="panel-title">{readTierLabel(offer.tier)}</h3>
                  <span className="badge">
                    {offer.monthlyPriceCents == null
                      ? 'A medida'
                      : `Desde ${formatMoney(offer.monthlyPriceCents)}/mes`}
                  </span>
                </div>

                <p className="muted">{readOfferDescription(offer)}</p>

                <dl className="detail-list">
                  <div>
                    <dt>Vaults</dt>
                    <dd>{offer.limits.maxVaults ?? 'Ilimitado'}</dd>
                  </div>
                  <div>
                    <dt>Notary / mes</dt>
                    <dd>{offer.limits.monthlyNotaryRequests ?? 'Ilimitado'}</dd>
                  </div>
                  <div>
                    <dt>Zero Trust</dt>
                    <dd>{readZtModeLabel(offer.limits.ztMode)}</dd>
                  </div>
                  <div>
                    <dt>Tamaño máximo por archivo</dt>
                    <dd>{offer.limits.maxFileSizeMb ? `${offer.limits.maxFileSizeMb} MB` : 'Ilimitado'}</dd>
                  </div>
                  <div>
                    <dt>Tamaño máximo por vault</dt>
                    <dd>{offer.limits.maxVaultStorageGb ? `${offer.limits.maxVaultStorageGb} GB` : 'Ilimitado'}</dd>
                  </div>
                  <div>
                    <dt>Usuarios</dt>
                    <dd>{offer.limits.maxUsers ?? 'Ilimitado'}</dd>
                  </div>
                  <div>
                    <dt>Anual</dt>
                    <dd>{offer.yearlyPriceCents == null ? 'A medida' : `${formatMoney(offer.yearlyPriceCents)} / año`}</dd>
                  </div>
                </dl>

                {offer.selfServe ? (
                  <form action={createCheckoutSessionAction} className="stack">
                    <input name="industry" type="hidden" value={offer.industry} />
                    <input name="tier" type="hidden" value={offer.tier} />
                    <input name="companyName" type="hidden" value={session.tenant.name} />
                    <input
                      name="billingEmail"
                      type="hidden"
                      value={overview.customer?.billingEmail ?? session.user.email}
                    />
                    <div className="grid-2">
                      <div className="field">
                        <label htmlFor={`${offer.industry}-${offer.tier}-billingCycle`}>Facturación</label>
                        <select
                          className="select"
                          defaultValue="monthly"
                          id={`${offer.industry}-${offer.tier}-billingCycle`}
                          name="billingCycle"
                        >
                          <option value="monthly">Mensual</option>
                          <option value="yearly">Anual</option>
                        </select>
                      </div>
                      <div className="field">
                        <label htmlFor={`${offer.industry}-${offer.tier}-seats`}>Usuarios</label>
                        <input
                          className="input"
                          defaultValue="1"
                          id={`${offer.industry}-${offer.tier}-seats`}
                          min={1}
                          name="seats"
                          type="number"
                        />
                      </div>
                    </div>

                    {offer.tier === 'BUSINESS' ? (
                      <div className="stack-sm">
                        <span className="settings-meta-label">Add-ons API opcionales</span>
                        <div className="settings-card-stack">
                          {apiPackages.map((pack) => (
                            <label className="toggle-card" key={pack.code}>
                              <input
                                defaultChecked={pack.code === 'AUTH_API' ? false : undefined}
                                disabled={pack.code !== 'AUTH_API'}
                                name="addOns"
                                type="checkbox"
                                value={pack.code}
                              />
                              <span>
                                {pack.name} · {formatMoney(pack.monthlyPriceCents)}/mes
                              </span>
                              <small className="muted">{readApiAddonDependencyLabel(pack.code)}</small>
                            </label>
                          ))}
                        </div>
                        <p className="hint">
                          Por ahora, si querés activar Vault API o Zero Trust API, primero te acompañamos a habilitar Auth API como base de integración.
                        </p>
                      </div>
                    ) : null}

                    <button className="button" type="submit">
                      Elegir {readTierLabel(offer.tier)}
                    </button>
                  </form>
                ) : (
                  <div className="stack">
                    <p className="muted">
                      Este plan se define según las necesidades de tu organización.
                    </p>
                    <Link
                      className="button-secondary"
                      href={createSalesMailto(
                        session.tenant.name,
                        readIndustryLabel(offer.industry),
                        readTierLabel(offer.tier),
                      )}
                    >
                      Hablar con ventas
                    </Link>
                  </div>
                )}
              </article>
            ))}
          </div>
        )}
      </section>

      <section className="panel">
        <div className="panel-head">
          <h2 className="panel-title">Paquetes de API</h2>
          <span className="badge">Add-ons</span>
        </div>

        <p className="muted">
          El plan base cubre el workspace. Si tu equipo necesita integrar Sytadel dentro de aplicaciones propias, los accesos API se activan como paquetes adicionales.
        </p>

        <div className="grid-3">
          {apiPackages.map((pack) => {
            const enabledByTier = currentTierRank >= getTierRank(pack.availableFromTier);

            return (
              <article className="panel" key={pack.code}>
                <div className="panel-head">
                  <h3 className="panel-title">{pack.name}</h3>
                  <span className="badge">Desde {readTierLabel(pack.availableFromTier)}</span>
                </div>

                <p className="muted">{pack.description}</p>

                <ul className="app-bullet-list">
                  {pack.features.map((feature) => (
                    <li key={feature}>{feature}</li>
                  ))}
                </ul>

                <div className="stack-sm">
                  <span className="muted">
                    {formatMoney(pack.monthlyPriceCents)}/mes o {formatMoney(pack.yearlyPriceCents)}/año
                  </span>
                  <span className="muted">{readApiAddonDependencyLabel(pack.code)}</span>
                  <span className={enabledByTier ? 'status-badge' : 'badge'}>
                    {enabledByTier
                      ? `Disponible para tu plan ${currentTierLabel}`
                      : `Requiere plan ${readTierLabel(pack.availableFromTier)} o superior`}
                  </span>

                  <Link
                    className="button-secondary"
                    href={createApiSalesMailto(session.tenant.name, pack.name)}
                  >
                    Consultar este paquete
                  </Link>
                </div>
              </article>
            );
          })}
        </div>
      </section>
    </div>
  );
}
