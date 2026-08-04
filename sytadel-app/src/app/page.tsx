const previewCards = [
  {
    eyebrow: 'Tenant overview',
    title: 'Resumen ejecutivo del tenant',
    copy:
      'Panel con estado operativo, capacidad activa, controles clave y métricas listas para seguimiento.',
    chips: ['Plan activo', 'Zero Trust', 'Vaults', 'Roles'],
  },
  {
    eyebrow: 'Vault workflow',
    title: 'Vaults y evidencias en una sola vista',
    copy:
      'Seguimiento de resguardo documental, movimientos recientes y permisos críticos desde una consola central.',
    chips: ['Documentos', 'Custodia', 'Accesos', 'Historial'],
  },
  {
    eyebrow: 'Billing + access',
    title: 'Operación comercial y acceso coordinados',
    copy:
      'Visibilidad de membresías, capacidades por plan y acciones para escalar sin perder gobernanza.',
    chips: ['Facturación', 'Membresías', 'Límites', 'Upgrade'],
  },
];

const featureHighlights = [
  'Auth, vaults y operación segura en un mismo producto.',
  'Experiencia pensada para vender, implementar y auditar con claridad.',
  'Disponible pronto en una versión pública lista para onboarding comercial.',
];

export default function HomePage() {
  return (
    <main className="coming-shell">
      <div className="coming-ambient coming-ambient-left" />
      <div className="coming-ambient coming-ambient-right" />

      <section className="coming-hero">
        <div className="coming-copy">
          <div className="brand-row coming-brand-row">
            <span className="brand-mark" aria-hidden="true">
              <svg viewBox="0 0 128 128" fill="none">
                <path
                  d="M83.5 38.5H55.5C47.5 38.5 42 43 42 49.5C42 56.2 46.6 59.6 56.2 62.1L67 64.9C73.4 66.5 76 68.4 76 72C76 76.2 72.4 79 66.2 79H37.8"
                  stroke="url(#brand-mark-stroke-coming)"
                  strokeWidth="10"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <path
                  d="M46 93.5H74C82 93.5 87.5 89 87.5 82.5C87.5 75.8 82.9 72.4 73.3 69.9L62.5 67.1C56.1 65.5 53.5 63.6 53.5 60C53.5 55.8 57.1 53 63.3 53H91.7"
                  stroke="url(#brand-mark-stroke-coming)"
                  strokeWidth="10"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <defs>
                  <linearGradient
                    id="brand-mark-stroke-coming"
                    x1="30"
                    y1="26"
                    x2="95"
                    y2="102"
                    gradientUnits="userSpaceOnUse"
                  >
                    <stop stopColor="#F8F2FF" />
                    <stop offset="1" stopColor="#E6D8FF" />
                  </linearGradient>
                </defs>
              </svg>
            </span>
            <div>
              <div className="brand-text">Sytadel Console</div>
              <div className="muted">Próximo lanzamiento</div>
            </div>
          </div>

          <span className="coming-pill">Coming soon</span>
          <h1 className="coming-title">La consola operativa de Sytadel ya está en camino.</h1>
          <p className="coming-description">
            Estamos preparando la primera versión pública de `app.sytadel-labs.com`
            para mostrar autenticación centralizada, vaults, trazabilidad y control
            comercial en una sola experiencia.
          </p>

          <div className="coming-actions">
            <a className="button" href="mailto:sytadel.labs@gmail.com?subject=Quiero%20conocer%20Sytadel">
              Contactarnos
            </a>
            <a className="button-secondary" href="/login">
              Ver demo privada
            </a>
          </div>

          <div className="coming-highlights">
            {featureHighlights.map((item) => (
              <div className="coming-highlight" key={item}>
                {item}
              </div>
            ))}
          </div>
        </div>

        <div className="coming-preview-stack" aria-label="Previews del software">
          {previewCards.map((card, index) => (
            <article className={`screen-card screen-card-${index + 1}`} key={card.title}>
              <div className="screen-topbar">
                <span />
                <span />
                <span />
              </div>
              <div className="screen-body">
                <div className="screen-sidebar">
                  <div className="screen-sidebar-mark" />
                  <div className="screen-sidebar-line short" />
                  <div className="screen-sidebar-line" />
                  <div className="screen-sidebar-line" />
                  <div className="screen-sidebar-line short" />
                </div>
                <div className="screen-main">
                  <div className="screen-header">
                    <p>{card.eyebrow}</p>
                    <h2>{card.title}</h2>
                    <span>{card.copy}</span>
                  </div>
                  <div className="screen-metrics">
                    <div />
                    <div />
                    <div />
                  </div>
                  <div className="screen-grid">
                    <div className="screen-panel screen-panel-large" />
                    <div className="screen-panel" />
                    <div className="screen-panel" />
                  </div>
                  <div className="screen-chips">
                    {card.chips.map((chip) => (
                      <span key={chip}>{chip}</span>
                    ))}
                  </div>
                </div>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="coming-contact">
        <div className="coming-contact-copy">
          <span className="coming-section-label">Contacto</span>
          <h2>¿Quieres acceso anticipado o una demo?</h2>
          <p>
            Escríbenos y coordinamos una presentación del software, casos de uso y
            roadmap comercial para tu organización.
          </p>
        </div>

        <div className="coming-contact-card">
          <div className="stack-sm">
            <span className="badge">Email directo</span>
            <strong className="coming-contact-email">sytadel.labs@gmail.com</strong>
            <p className="muted">
              También podemos preparar una demo privada sobre el entorno actual.
            </p>
          </div>

          <div className="coming-actions">
            <a
              className="button"
              href="mailto:sytadel.labs@gmail.com?subject=Quiero%20una%20demo%20de%20Sytadel&body=Hola%20equipo%2C%20quiero%20coordinar%20una%20demo."
            >
              Escribir ahora
            </a>
            <a className="button-ghost" href="https://www.sytadel-labs.com" target="_blank" rel="noreferrer">
              Ir al sitio
            </a>
          </div>
        </div>
      </section>
    </main>
  );
}
