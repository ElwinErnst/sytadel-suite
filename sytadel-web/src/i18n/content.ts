export const locales = ['es', 'en', 'pt'] as const;

export type Locale = (typeof locales)[number];

type NavLink = {
  label: string;
  href: string;
};

type HeroCopy = {
  eyebrow: string;
  title: string;
  description: string;
  tags: string[];
  primaryCta: string;
  secondaryCta: string;
  stats: Array<{ value: string; label: string }>;
};

type SectionCard = {
  title: string;
  description: string;
};

type UseCase = {
  title: string;
  description: string;
};

type PageCopy = {
  metaTitle: string;
  metaDescription: string;
  languageLabel: string;
  launch: {
    badge: string;
    text: string;
    cta: string;
  };
  nav: NavLink[];
  hero: HeroCopy;
  proof: string[];
  platform: {
    title: string;
    description: string;
    cards: SectionCard[];
  };
  integrations: {
    title: string;
    description: string;
    cards: SectionCard[];
  };
  modules: {
    title: string;
    description: string;
    cards: SectionCard[];
  };
  useCases: {
    title: string;
    description: string;
    items: UseCase[];
  };
  workflow: {
    title: string;
    description: string;
    steps: Array<{ title: string; description: string }>;
  };
  security: {
    title: string;
    description: string;
    bullets: string[];
  };
  pricing: {
    title: string;
    description: string;
    plans: Array<{
      name: string;
      price: string;
      detail: string;
      features: string[];
    }>;
    apiAddons: {
      title: string;
      description: string;
      packages: Array<{
        name: string;
        availability: string;
        description: string;
        features: string[];
      }>;
    };
  };
  cta: {
    title: string;
    description: string;
    primary: string;
    secondary: string;
  };
  demo: {
    kicker: string;
    title: string;
    description: string;
    disclaimer: string;
    placeholder: string;
    send: string;
    thinking: string;
    reset: string;
    toolLabel: string;
    resultLabel: string;
    errorGeneric: string;
    errorUnavailable: string;
    suggestions: string[];
  };
  footer: string;
};

export const defaultLocale: Locale = 'es';

export const copy: Record<Locale, PageCopy> = {
  es: {
    metaTitle: 'Sytadel Labs | Zero trust operacional para infraestructura moderna',
    metaDescription:
      'Sytadel Labs es la capa de control para acceso seguro, identidad y operaciones zero trust en infraestructura moderna.',
    languageLabel: 'Idioma',
    launch: {
      badge: 'Sytadel Labs',
      text: 'Cuando acceso, identidad y trazabilidad están fragmentados, el riesgo operativo se vuelve invisible. Sytadel ayuda a ordenar esa operación con control claro desde el primer día.',
      cta: 'Ver por qué importa',
    },
    nav: [
      { label: 'Demo', href: '#demo' },
      { label: 'Producto', href: '#producto' },
      { label: 'APIs', href: '#apis' },
      { label: 'Módulos', href: '#modulos' },
      { label: 'Seguridad', href: '#seguridad' },
    ],
    hero: {
      eyebrow: 'Infraestructura de seguridad · con IA',
      title: 'Los cimientos de seguridad de tu SaaS, resueltos.',
      description:
        'Identidad y passkeys, un gateway Zero Trust con políticas, un vault con notarización a prueba de manipulación, y cobros — como módulos que enchufás. Con una capa de IA que detecta anomalías, compila políticas en lenguaje natural y asiste las decisiones de acceso. Somos una startup de seguridad: corremos sobre nuestro propio stack.',
      tags: [
        'Identidad + passkeys (WebAuthn)',
        'Gateway Zero Trust + políticas',
        'Vault + Notary (Merkle · RFC 3161)',
        'Cobros seguros (MercadoPago · Stripe)',
        'IA: anomalías · NL→RBAC · access review',
        'MCP server para Claude',
      ],
      primaryCta: 'Mirá el agente en acción',
      secondaryCta: 'Ver los módulos',
      stats: [
        { value: '1 capa', label: 'una sola base para quitar accesos improvisados, credenciales heredadas y decisiones aisladas' },
        { value: 'Políticas claras', label: 'reglas visibles para ordenar quién accede, quién valida y cómo se resguarda cada activo crítico' },
        { value: 'Evidencia real', label: 'historial y prueba verificable para auditorías, compliance y operaciones sensibles' },
      ],
    },
    proof: [
      'Infraestructura moderna',
      'Acceso seguro',
      'Identidad centralizada',
      'Zero trust operativo',
      'APIs listas para integrar',
    ],
    platform: {
      title: 'Sytadel es la capa de control para equipos que operan infraestructura y sistemas críticos',
      description:
        'Muchos equipos crecen con accesos concedidos por urgencia, información sensible repartida en varias herramientas y controles que recién aparecen cuando algo sale mal. Sytadel ordena esa operación con una capa clara de control antes de que el costo sea una auditoría fallida, una venta trabada o una exposición innecesaria.',
      cards: [
        {
          title: 'Identidad como base operativa',
          description:
            'Usuarios, equipos y permisos se administran desde un mismo criterio para cortar accesos heredados, evitar privilegios acumulados y saber exactamente quién puede intervenir en cada proceso crítico.',
        },
        {
          title: 'Acceso controlado en cada interacción',
          description:
            'Cada acceso a información crítica puede quedar sujeto a políticas claras en vez de depender de confianza implícita o validaciones manuales que no escalan.',
        },
        {
          title: 'Operación con trazabilidad',
          description:
            'Las acciones relevantes quedan registradas para que el equipo responda auditorías, investigue actividad sensible y demuestre control sin reconstruir evidencia a último momento.',
        },
        {
          title: 'Servicios que encajan entre sí',
          description:
            'Vault, ZeroTrust y Notary funcionan como una base conectada para que el control no quede repartido entre herramientas separadas y frágiles.',
        },
      ],
    },
    integrations: {
      title: 'APIs y servicios para integrarlo con tus sistemas',
      description:
        'Sytadel no se queda en una consola aislada. La plataforma puede integrarse con aplicaciones propias para resolver login, Zero Trust y resguardo cifrado de archivos dentro de los flujos que tu equipo ya usa.',
      cards: [
        {
          title: 'Login e identidad para tus aplicaciones',
          description:
            'Centralizá autenticación, tenants, memberships y sesiones para que tus productos no dependan de lógica de acceso dispersa en cada app.',
        },
        {
          title: 'Zero Trust como capa para tus integraciones',
          description:
            'Protegé requests entre servicios y aplicaciones con validación de identidad, políticas y acceso controlado sobre operaciones sensibles.',
        },
        {
          title: 'Almacenamiento cifrado de archivos',
          description:
            'Guardá documentos y activos sensibles con cifrado, trazabilidad y control de acceso sin tener que diseñar todo ese stack desde cero.',
        },
        {
          title: 'Integración API-first',
          description:
            'Conectá Sytadel con sistemas internos, portales de clientes o flujos regulatorios sin romper la operación existente ni duplicar permisos.',
        },
      ],
    },
    modules: {
      title: 'Qué hace cada servicio',
      description:
        'Cada componente existe para resolver un bloqueo operativo concreto. Juntos convierten control, trazabilidad e integración en una ventaja práctica, no en una capa burocrática.',
      cards: [
        {
          title: 'Sytadel Auth',
          description:
            'Identidad completa: usuarios, sesiones con rotación y detección de reuso, y passkeys (WebAuthn) resistentes a phishing. Roles por tenant (RBAC).',
        },
        {
          title: 'Sytadel ZeroTrust',
          description:
            'Un gateway que verifica cada request: valida identidad, evalúa políticas (default deny) y firma criptográficamente antes de que llegue a cualquier servicio.',
        },
        {
          title: 'Sytadel Vault + Notary',
          description:
            'Documentos cifrados (envelope encryption) con auditoría append-only, y notarización a prueba de manipulación vía Merkle + RFC 3161.',
        },
        {
          title: 'Sytadel Billing',
          description:
            'Cobros por suscripción, por uso o pago único. Envuelve a MercadoPago y Stripe con webhooks verificados: configurás los parámetros y cobrás seguro.',
        },
        {
          title: 'Sytadel AI',
          description:
            'Detección de anomalías de sesión, políticas RBAC desde lenguaje natural, access reviews automáticos, y un agente HITL que propone accesos — el humano decide.',
        },
        {
          title: 'Sytadel MCP',
          description:
            'Un servidor MCP que expone estas capacidades como tools, para que Claude opere tu seguridad desde el mismo chat.',
        },
      ],
    },
    useCases: {
      title: 'Casos de uso por industria',
      description:
        'Sytadel encaja donde una mala postura de acceso no solo implica riesgo técnico: también complica auditorías, frena operaciones y debilita la confianza en el servicio.',
      items: [
        {
          title: 'Fintech',
          description:
            'Para KYC, onboarding, documentación financiera y operaciones donde una mala postura de acceso frena cierres, auditorías y alianzas.',
        },
        {
          title: 'GovTech',
          description:
            'Para expedientes, licitaciones y documentación pública donde custodia, historial y gobernanza deben ser defendibles.',
        },
        {
          title: 'HealthTech',
          description:
            'Para historiales, estudios y documentación clínica donde el permiso correcto, la continuidad y la reputación no pueden quedar librados al azar.',
        },
        {
          title: 'LegalTech',
          description:
            'Para contratos, evidencia y documentación jurídica donde integridad, orden y trazabilidad forman parte directa del servicio vendido.',
        },
      ],
    },
    workflow: {
      title: 'Cómo opera un equipo con Sytadel',
      description:
        'La plataforma está diseñada para que el control aparezca temprano en la operación diaria, no recién cuando el equipo ya está apagando incendios o juntando evidencia a las apuradas.',
      steps: [
        {
          title: '1. Definís identidades y recursos',
          description:
            'El equipo organiza usuarios, roles, servicios y activos críticos dentro de una misma base operativa para eliminar zonas grises desde el inicio.',
        },
        {
          title: '2. Aplicás políticas de acceso',
          description:
            'Las reglas de acceso se aplican sobre cada interacción relevante para mantener control claro sobre recursos sensibles sin depender de aprobaciones informales.',
        },
        {
          title: '3. Revisás actividad y evidencia',
          description:
            'Cuando hace falta validar una operación, defender una integración o respaldar un activo, el historial y la evidencia verificable ya están disponibles.',
        },
      ],
    },
    security: {
      title: 'Principios de producto',
      description:
        'Sytadel está pensado para equipos que necesitan demostrar control, no solo declararlo. La seguridad tiene que verse, aplicarse y sostenerse en el tiempo.',
      bullets: [
        'Acceso seguro simple de aplicar y simple de revisar cuando la operación ya está en marcha.',
        'Identidad centralizada como base para decisiones operativas más claras y consistentes.',
        'Políticas enforceables sobre infraestructura y activos críticos sin depender de memoria o buena voluntad.',
        'Operaciones modernas con seguridad como comportamiento por defecto, no como proyecto paralelo.',
      ],
    },
    pricing: {
      title: 'Planes para cada etapa de crecimiento',
      description:
        'Mostramos una estructura simple para empezar. Después, según tu tipo de organización, vas a ver el paquete que mejor se adapte a tu operación. El acceso a APIs se suma como paquete aparte.',
      plans: [
        {
          name: 'Free',
          price: 'US$ 0 / mes',
          detail: 'Para explorar la plataforma y validar si encaja con tu operación.',
          features: [
            'Acceso inicial para evaluación',
            'Primer contacto con el flujo de trabajo',
            'Ideal para descubrir la plataforma antes de crecer',
          ],
        },
        {
          name: 'Base',
          price: 'Desde US$ 79 / mes',
          detail: 'Para equipos que empiezan a ordenar acceso, documentos y trazabilidad.',
          features: [
            'Capacidad inicial para operar con orden',
            'Límites pensados para primeras etapas',
            'Base lista para crecer con tu organización',
          ],
        },
        {
          name: 'Growth',
          price: 'Desde US$ 149 / mes',
          detail: 'Para organizaciones en expansión que necesitan más volumen y control.',
          features: [
            'Más capacidad para equipos y operaciones',
            'Mayor volumen para documentos y evidencia',
            'Preparado para procesos más exigentes',
          ],
        },
        {
          name: 'Business',
          price: 'Desde US$ 299 / mes',
          detail: 'Para empresas que necesitan mayor escala, controles más fuertes y operación sostenida.',
          features: [
            'Más capacidad para equipos, archivos y vaults',
            'Más margen para auditoría y continuidad',
            'Listo para operaciones con mayor exigencia',
          ],
        },
        {
          name: 'Custom',
          price: 'A medida',
          detail: 'Para organizaciones con necesidades específicas, mayor volumen o requerimientos especiales.',
          features: [
            'Configuración adaptada al negocio',
            'Límites y capacidades a medida',
            'Acompañamiento para casos específicos',
          ],
        },
      ],
      apiAddons: {
        title: 'Paquetes API para integraciones',
        description:
          'El plan base cubre el workspace. Si tu equipo necesita integrar Sytadel dentro de aplicaciones propias, el acceso programático se habilita como add-on separado.',
        packages: [
          {
            name: 'Auth API Pack',
            availability: 'Disponible en Business',
            description:
              'Para usar Sytadel como sistema de autenticación dentro de productos, portales o herramientas internas.',
            features: [
              'Login, sesiones y tenants para tus apps',
              'Gestión de users y memberships',
              'Pack base requerido para habilitar Vault API y Zero Trust API',
              'Ideal para centralizar autenticación en sistemas propios',
            ],
          },
          {
            name: 'Vault API Pack',
            availability: 'Disponible en Business',
            description:
              'Para operar Vault desde tus sistemas con acceso programático protegido.',
            features: [
              'Acceso programático a Vault',
              'Todo el tráfico pasa por Zero Trust',
              'Requiere Auth API Pack activo',
              'Pensado para flujos documentales protegidos',
            ],
          },
          {
            name: 'Zero Trust API Pack',
            availability: 'Disponible en Business',
            description:
              'Para equipos que necesitan exponer políticas, upstreams y controles avanzados en integraciones serias.',
            features: [
              'Capacidades avanzadas de Zero Trust',
              'Mayor flexibilidad para integraciones',
              'Requiere Auth API Pack activo',
              'Ideal para operación productiva de mayor escala',
            ],
          },
        ],
      },
    },
    cta: {
      title: 'Mostremos dónde hoy están perdiendo control, tiempo o confianza.',
      description:
        'Podemos preparar una demo centrada en cómo Sytadel reduce fricción, mejora trazabilidad y vuelve más defendibles las decisiones operativas del día a día.',
      primary: 'Agendar demo',
      secondary: 'Ver módulos',
    },
    demo: {
      kicker: 'Cómo funciona',
      title: 'Mirá al agente en acción.',
      description:
        'Una animación de una sesión real: el agente usa los mismos tools del servidor MCP de Sytadel sobre un tenant demo. Mirá qué herramienta llama y qué devuelve — access review, políticas, notarización. Sin instalar nada.',
      disclaimer:
        'Animación con datos de demo — muestra el flujo real, sin llamadas en vivo ni costo.',
      placeholder: 'Preguntá sobre usuarios, anomalías o el estado de acceso…',
      send: 'Enviar',
      thinking: 'El agente está pensando…',
      reset: 'Reproducir',
      toolLabel: 'Tool',
      resultLabel: 'Resultado',
      errorGeneric: 'El demo no pudo responder eso. Probá de nuevo.',
      errorUnavailable:
        'El demo en vivo no está disponible en este entorno. Escribinos para una demo privada.',
      suggestions: [
        '¿Quién tiene acceso de más en este tenant?',
        'Corré un access review y mostrame los hallazgos críticos.',
        'Mostrame las anomalías de sesión recientes.',
        'Compilá una policy: OWNER hace todo, MEMBER solo GET /vaults, default deny.',
      ],
    },
    footer: 'Sytadel Labs. Acceso seguro, identidad y zero trust operativo para infraestructura moderna.',
  },
  en: {
    metaTitle: 'Sytadel Labs | Zero trust made operational',
    metaDescription:
      'Sytadel Labs is the control layer for secure access, identity, and zero-trust operations in modern infrastructure.',
    languageLabel: 'Language',
    launch: {
      badge: 'Sytadel Labs',
      text: 'When access, identity, and traceability stay fragmented, operational risk becomes invisible. Sytadel helps teams bring that operation under clear control from day one.',
      cta: 'See why it matters',
    },
    nav: [
      { label: 'Demo', href: '#demo' },
      { label: 'Product', href: '#product' },
      { label: 'APIs', href: '#apis' },
      { label: 'Modules', href: '#modules' },
      { label: 'Security', href: '#security' },
    ],
    hero: {
      eyebrow: 'Security infrastructure · with AI',
      title: "Your SaaS's security foundations, solved.",
      description:
        'Identity and passkeys, a Zero Trust gateway with policies, a vault with tamper-evident notarization, and payments — as modules you plug in. Plus an AI layer that detects anomalies, compiles policies from natural language, and assists access decisions. We are a security startup: we run on our own stack.',
      tags: [
        'Identity + passkeys (WebAuthn)',
        'Zero Trust gateway + policies',
        'Vault + Notary (Merkle · RFC 3161)',
        'Secure payments (MercadoPago · Stripe)',
        'AI: anomalies · NL→RBAC · access review',
        'MCP server for Claude',
      ],
      primaryCta: 'See the agent in action',
      secondaryCta: 'See the modules',
      stats: [
        { value: '1 layer', label: 'one foundation to remove improvised access, inherited credentials, and isolated decisions' },
        { value: 'Clear policies', label: 'rules teams can apply to define who accesses, approves, and safeguards each critical asset' },
        { value: 'Real evidence', label: 'traceability and verifiable proof for audits, compliance, and demanding commercial relationships' },
      ],
    },
    proof: [
      'Modern infrastructure',
      'Secure access',
      'Centralized identity',
      'Operational zero trust',
      'API-ready integrations',
    ],
    platform: {
      title: 'Sytadel is the control layer for teams operating infrastructure and critical systems',
      description:
        'Many teams grow with access granted out of urgency, sensitive information spread across tools, and controls that only appear after something goes wrong. Sytadel organizes that operation around a clear control layer before the cost becomes a failed audit, a stalled deal, or unnecessary exposure.',
      cards: [
        {
          title: 'Identity as an operational foundation',
          description:
            'Users, teams, and permissions are managed through one model so access no longer depends on inherited rules, privilege creep, or isolated decisions around each critical process.',
        },
        {
          title: 'Access control on every interaction',
          description:
            'Each access to critical information can be governed through policy instead of relying on implicit trust or manual approvals that do not scale.',
        },
        {
          title: 'Operations with traceability',
          description:
            'Relevant actions stay recorded so teams can answer audits, investigate sensitive activity, and prove control without rebuilding evidence at the last minute.',
        },
        {
          title: 'Services that fit together',
          description:
            'Vault, ZeroTrust, and Notary work as one connected base so control does not depend on separate and fragile tools.',
        },
      ],
    },
    integrations: {
      title: 'APIs and services that fit into your systems',
      description:
        'Sytadel is not limited to a standalone console. The platform can plug into your own applications to handle login, Zero Trust, and encrypted file storage inside the workflows your team already runs.',
      cards: [
        {
          title: 'Login and identity for your applications',
          description:
            'Centralize authentication, tenants, memberships, and sessions so your products do not rely on fragmented access logic in every app.',
        },
        {
          title: 'Zero Trust for service-to-service access',
          description:
            'Protect requests across services and applications with identity validation, policy enforcement, and controlled access over sensitive operations.',
        },
        {
          title: 'Encrypted file storage',
          description:
            'Store sensitive files and records with encryption, traceability, and access control without having to build that whole stack yourself.',
        },
        {
          title: 'API-first integration',
          description:
            'Connect Sytadel with internal systems, customer portals, or regulated workflows without breaking the existing operating model or duplicating permissions.',
        },
      ],
    },
    modules: {
      title: 'What each service does',
      description:
        'Each component exists to solve a concrete operational blocker. Together they turn control, traceability, and integration into a practical advantage instead of an administrative burden.',
      cards: [
        {
          title: 'Sytadel Auth',
          description:
            'Full identity: users, sessions with rotation and reuse detection, and phishing-resistant passkeys (WebAuthn). Per-tenant roles (RBAC).',
        },
        {
          title: 'Sytadel ZeroTrust',
          description:
            'A gateway that verifies every request: validates identity, evaluates policies (default deny), and cryptographically signs it before it reaches any service.',
        },
        {
          title: 'Sytadel Vault + Notary',
          description:
            'Encrypted documents (envelope encryption) with an append-only audit log, and tamper-evident notarization via Merkle + RFC 3161.',
        },
        {
          title: 'Sytadel Billing',
          description:
            'Subscription, usage-based, or one-off payments. Wraps MercadoPago and Stripe with verified webhooks: you set the parameters and charge securely.',
        },
        {
          title: 'Sytadel AI',
          description:
            'Session anomaly detection, RBAC policies from natural language, automated access reviews, and a HITL agent that proposes access — the human decides.',
        },
        {
          title: 'Sytadel MCP',
          description:
            'An MCP server that exposes these capabilities as tools, so Claude can operate your security from the chat itself.',
        },
      ],
    },
    useCases: {
      title: 'Industry use cases',
      description:
        'Sytadel fits sectors where a weak access posture is not only a technical risk: it also slows deals, complicates audits, and weakens commercial trust.',
      items: [
        {
          title: 'Fintech',
          description:
            'For KYC, onboarding, financial records, and operations with strict access, traceability, and audit requirements.',
        },
        {
          title: 'GovTech',
          description:
            'For case files, tenders, and public records where custody, history, and governance must be defendable.',
        },
        {
          title: 'HealthTech',
          description:
            'For records, studies, and sensitive clinical documentation where the right permission model directly affects continuity and reputation.',
        },
        {
          title: 'LegalTech',
          description:
            'For contracts, evidence, and legal records where integrity, order, and traceability are part of the service being sold.',
        },
      ],
    },
    workflow: {
      title: 'How teams operate with Sytadel',
      description:
        'The platform is designed so control appears early in daily operations, not only once teams are already fighting fires or rebuilding evidence under pressure.',
      steps: [
        {
          title: '1. Define identities and resources',
          description:
            'Teams organize users, roles, services, and critical assets inside one operational base to remove gray areas from the start.',
        },
        {
          title: '2. Apply access policies',
          description:
            'Access rules are enforced on relevant interactions so sensitive resources remain under clear control without informal approvals.',
        },
        {
          title: '3. Review activity and evidence',
          description:
            'When validation is needed to support an operation, integration, or critical asset, history and verifiable evidence are already available.',
        },
      ],
    },
    security: {
      title: 'Product principles',
      description:
        'Sytadel is built for teams that need to prove control, not just claim it. Security has to be visible, enforceable, and durable.',
      bullets: [
        'Secure access that stays simple to apply and simple to review even as operations grow.',
        'Centralized identity as a foundation for stronger operational and commercial decisions.',
        'Enforceable policy across infrastructure and critical assets without relying on memory or goodwill.',
        'Modern operations with security as a default behavior, not a parallel project.',
      ],
    },
    pricing: {
      title: 'Plans for every growth stage',
      description:
        'We keep the public structure simple. Once your team is inside, you can see the package that best fits your organization and operational needs. API access is added as a separate package.',
      plans: [
        {
          name: 'Free',
          price: 'US$ 0 / month',
          detail: 'To explore the platform and validate whether it fits your operation.',
          features: [
            'Initial access for evaluation',
            'First contact with the workflow',
            'Ideal before moving to a larger plan',
          ],
        },
        {
          name: 'Base',
          price: 'From US$ 79 / month',
          detail: 'For teams starting to organize access, documents, and traceability.',
          features: [
            'Entry capacity for early operations',
            'Limits designed for first-stage growth',
            'A solid foundation to expand from',
          ],
        },
        {
          name: 'Growth',
          price: 'From US$ 149 / month',
          detail: 'For growing organizations that need more volume and stronger control.',
          features: [
            'More room for teams and workflows',
            'Higher volume for documents and evidence',
            'Built for more demanding operations',
          ],
        },
        {
          name: 'Business',
          price: 'From US$ 299 / month',
          detail: 'For companies that need greater scale, stronger controls, and sustained operations.',
          features: [
            'More capacity for teams, files, and vaults',
            'More room for audit and continuity needs',
            'Ready for higher operational pressure',
          ],
        },
        {
          name: 'Custom',
          price: 'Custom',
          detail: 'For organizations with specific requirements, larger volume, or specialized operating models.',
          features: [
            'Configuration adapted to the business',
            'Tailored limits and capabilities',
            'Support for specific operating needs',
          ],
        },
      ],
      apiAddons: {
        title: 'API add-on packages',
        description:
          'The base plan covers the workspace itself. If your team needs to integrate Sytadel into your own applications, API access can be added separately.',
        packages: [
          {
            name: 'Auth API Pack',
            availability: 'Available in Business',
            description:
              'Use Sytadel as the authentication layer for products, portals, or internal tools.',
            features: [
              'Login, sessions, and tenants for your apps',
              'User and membership management',
              'Required base pack before enabling Vault API and Zero Trust API',
              'Built for centralized app authentication',
            ],
          },
          {
            name: 'Vault API Pack',
            availability: 'Available in Business',
            description:
              'Operate Vault from your own systems with protected programmatic access.',
            features: [
              'Programmatic access to Vault',
              'All traffic goes through Zero Trust',
              'Requires Auth API Pack',
              'Designed for protected document workflows',
            ],
          },
          {
            name: 'Zero Trust API Pack',
            availability: 'Available in Business',
            description:
              'Expose policies, upstreams, and advanced controls for demanding integrations.',
            features: [
              'Advanced Zero Trust capabilities',
              'More flexibility for integrations',
              'Requires Auth API Pack',
              'Built for larger production operations',
            ],
          },
        ],
      },
    },
    cta: {
      title: 'Let us show where control, time, or trust is leaking today.',
      description:
        'We can prepare a demo focused on how Sytadel reduces friction, improves traceability, and makes day-to-day operating decisions easier to defend.',
      primary: 'Book demo',
      secondary: 'See modules',
    },
    demo: {
      kicker: 'How it works',
      title: 'Watch the agent in action.',
      description:
        'An animation of a real session: the agent uses the same tools the Sytadel MCP server exposes, over a demo tenant. Watch which tool it calls and what it returns — access review, policies, notarization. No install.',
      disclaimer:
        'Animation with demo data — shows the real flow, no live calls and no cost.',
      placeholder: 'Ask about users, anomalies, or the access posture…',
      send: 'Send',
      thinking: 'The agent is thinking…',
      reset: 'Replay',
      toolLabel: 'Tool',
      resultLabel: 'Result',
      errorGeneric: 'The demo could not answer that. Try again.',
      errorUnavailable:
        'The live demo is not available in this environment. Reach out for a private demo.',
      suggestions: [
        'Who has too much access in this tenant?',
        'Run an access review and show me the critical findings.',
        'Show me the recent session anomalies.',
        'Compile a policy: OWNER can do anything, MEMBER only GET /vaults, default deny.',
      ],
    },
    footer: 'Sytadel Labs. Secure access, identity, and operational zero trust for modern infrastructure.',
  },
  pt: {
    metaTitle: 'Sytadel Labs | Zero trust operacional para infraestrutura moderna',
    metaDescription:
      'Sytadel Labs é a camada de controle para acesso seguro, identidade e operações zero trust em infraestrutura moderna.',
    languageLabel: 'Idioma',
    launch: {
      badge: 'Sytadel Labs',
      text: 'Quando acesso, identidade e rastreabilidade ficam fragmentados, o risco operacional se torna invisível. A Sytadel ajuda a colocar essa operação sob controle claro desde o primeiro dia.',
      cta: 'Ver por que isso importa',
    },
    nav: [
      { label: 'Demo', href: '#demo' },
      { label: 'Produto', href: '#produto' },
      { label: 'APIs', href: '#apis' },
      { label: 'Módulos', href: '#modulos' },
      { label: 'Segurança', href: '#seguranca' },
    ],
    hero: {
      eyebrow: 'Infraestrutura de segurança · com IA',
      title: 'As fundações de segurança do seu SaaS, resolvidas.',
      description:
        'Identidade e passkeys, um gateway Zero Trust com políticas, um vault com notarização à prova de adulteração, e cobranças — como módulos que você pluga. Com uma camada de IA que detecta anomalias, compila políticas em linguagem natural e assiste as decisões de acesso. Somos uma startup de segurança: rodamos sobre nosso próprio stack.',
      tags: [
        'Identidade + passkeys (WebAuthn)',
        'Gateway Zero Trust + políticas',
        'Vault + Notary (Merkle · RFC 3161)',
        'Cobranças seguras (MercadoPago · Stripe)',
        'IA: anomalias · NL→RBAC · access review',
        'MCP server para Claude',
      ],
      primaryCta: 'Veja o agente em ação',
      secondaryCta: 'Ver os módulos',
      stats: [
        { value: '1 camada', label: 'uma única base para remover acessos improvisados, credenciais herdadas e decisões isoladas' },
        { value: 'Políticas claras', label: 'regras aplicáveis para definir quem acessa, quem valida e como cada ativo crítico é resguardado' },
        { value: 'Evidência real', label: 'rastreabilidade e prova verificável para auditorias, compliance e relações comerciais exigentes' },
      ],
    },
    proof: [
      'Infraestrutura moderna',
      'Acesso seguro',
      'Identidade centralizada',
      'Zero trust operacional',
      'Integrações prontas via API',
    ],
    platform: {
      title: 'Sytadel é a camada de controle para equipes que operam infraestrutura e sistemas críticos',
      description:
        'Muitas equipes crescem com acessos concedidos por urgência, informação sensível espalhada entre ferramentas e controles que só aparecem depois que algo dá errado. A Sytadel organiza essa operação sobre uma camada clara de controle antes que o custo seja uma auditoria perdida, uma venda travada ou exposição desnecessária.',
      cards: [
        {
          title: 'Identidade como base operacional',
          description:
            'Usuários, equipes e permissões são administrados a partir de um mesmo modelo para cortar acessos herdados, evitar acúmulo de privilégios e saber exatamente quem pode atuar em cada processo crítico.',
        },
        {
          title: 'Controle de acesso em cada interação',
          description:
            'Cada acesso a informação crítica pode ficar sujeito a política clara, sem depender de confiança implícita ou aprovações manuais que não escalam.',
        },
        {
          title: 'Operação com rastreabilidade',
          description:
            'As ações relevantes ficam registradas para que a equipe responda auditorias, investigue atividade sensível e prove controle sem reconstruir evidência na última hora.',
        },
        {
          title: 'Serviços que se encaixam',
          description:
            'Vault, ZeroTrust e Notary funcionam como uma base conectada para que o controle não dependa de ferramentas separadas e frágeis.',
        },
      ],
    },
    integrations: {
      title: 'APIs e serviços para integrar com seus sistemas',
      description:
        'A Sytadel não fica presa a uma console isolada. A plataforma pode se integrar às suas próprias aplicações para resolver login, Zero Trust e armazenamento cifrado de arquivos dentro dos fluxos que sua equipe já utiliza.',
      cards: [
        {
          title: 'Login e identidade para suas aplicações',
          description:
            'Centralize autenticação, tenants, memberships e sessões para que seus produtos não dependam de lógica de acesso espalhada em cada app.',
        },
        {
          title: 'Zero Trust para acesso entre serviços',
          description:
            'Proteja requests entre serviços e aplicações com validação de identidade, políticas e acesso controlado sobre operações sensíveis.',
        },
        {
          title: 'Armazenamento cifrado de arquivos',
          description:
            'Armazene arquivos e registros sensíveis com cifrado, rastreabilidade e controle de acesso sem precisar construir todo esse stack do zero.',
        },
        {
          title: 'Integração API-first',
          description:
            'Conecte a Sytadel com sistemas internos, portais de clientes ou fluxos regulatórios sem quebrar a operação existente nem duplicar permissões.',
        },
      ],
    },
    modules: {
      title: 'O que cada serviço faz',
      description:
        'Cada componente existe para resolver um bloqueio operacional concreto. Juntos, eles transformam controle, rastreabilidade e integração em uma vantagem prática, não em burocracia.',
      cards: [
        {
          title: 'Sytadel Auth',
          description:
            'Identidade completa: usuários, sessões com rotação e detecção de reuso, e passkeys (WebAuthn) resistentes a phishing. Papéis por tenant (RBAC).',
        },
        {
          title: 'Sytadel ZeroTrust',
          description:
            'Um gateway que verifica cada request: valida a identidade, avalia políticas (default deny) e assina criptograficamente antes de chegar a qualquer serviço.',
        },
        {
          title: 'Sytadel Vault + Notary',
          description:
            'Documentos cifrados (envelope encryption) com auditoria append-only, e notarização à prova de adulteração via Merkle + RFC 3161 — sem blockchain.',
        },
        {
          title: 'Sytadel Billing',
          description:
            'Cobranças por assinatura, por uso ou pagamento único. Envolve MercadoPago e Stripe com webhooks verificados: você configura e cobra com segurança.',
        },
        {
          title: 'Sytadel AI',
          description:
            'Detecção de anomalias de sessão, políticas RBAC a partir de linguagem natural, access reviews automáticos, e um agente HITL que propõe acessos — o humano decide.',
        },
        {
          title: 'Sytadel MCP',
          description:
            'Um servidor MCP que expõe essas capacidades como tools, para que o Claude opere sua segurança a partir do próprio chat.',
        },
      ],
    },
    useCases: {
      title: 'Casos de uso por setor',
      description:
        'Sytadel encaixa em setores onde uma postura fraca de acesso não representa só risco técnico: ela também complica auditorias, atrasa operações e enfraquece a confiança no serviço.',
      items: [
        {
          title: 'Fintech',
          description:
            'Para KYC, onboarding, registros financeiros e operações onde uma postura fraca de acesso atrasa vendas, auditorias e parcerias.',
        },
        {
          title: 'GovTech',
          description:
            'Para expedientes, licitações e registros públicos onde custódia, histórico e governança precisam ser defensáveis.',
        },
        {
          title: 'HealthTech',
          description:
            'Para prontuários, estudos e documentação clínica sensível onde o modelo correto de permissão afeta continuidade e reputação.',
        },
        {
          title: 'LegalTech',
          description:
            'Para contratos, evidências e registros jurídicos onde integridade, ordem e rastreabilidade fazem parte do serviço vendido.',
        },
      ],
    },
    workflow: {
      title: 'Como uma equipe opera com Sytadel',
      description:
        'A plataforma foi desenhada para que o controle apareça cedo na operação diária, e não só quando a equipe já está apagando incêndios ou reconstruindo evidência sob pressão.',
      steps: [
        {
          title: '1. Defina identidades e recursos',
          description:
            'A equipe organiza usuários, funções, serviços e ativos críticos dentro de uma mesma base operacional para remover zonas cinzentas desde o início.',
        },
        {
          title: '2. Aplique políticas de acesso',
          description:
            'As regras de acesso são aplicadas sobre cada interação relevante para manter controle claro sobre recursos sensíveis sem depender de aprovações informais.',
        },
        {
          title: '3. Revise atividade e evidência',
          description:
            'Quando é preciso validar uma operação, defender uma integração ou sustentar um ativo, histórico e evidência verificável já estão disponíveis dentro da plataforma.',
        },
      ],
    },
    security: {
      title: 'Princípios de produto',
      description:
        'A Sytadel foi pensada para equipes que precisam provar controle, não apenas declará-lo. Segurança precisa ser visível, aplicável e duradoura.',
      bullets: [
        'Acesso seguro simples de aplicar e simples de revisar mesmo com a operação crescendo.',
        'Identidade centralizada como base para decisões operacionais e comerciais mais defensáveis.',
        'Políticas enforceables sobre infraestrutura e ativos críticos sem depender de memória ou boa vontade.',
        'Operações modernas com segurança como comportamento padrão, não como projeto paralelo.',
      ],
    },
    pricing: {
      title: 'Planos para cada etapa de crescimento',
      description:
        'Mantemos a estrutura pública simples. Depois, dentro da plataforma, sua equipe pode ver o pacote que melhor se encaixa no tipo de organização. O acesso às APIs entra como pacote separado.',
      plans: [
        {
          name: 'Free',
          price: 'US$ 0 / mês',
          detail: 'Para explorar a plataforma e validar se ela se encaixa na sua operação.',
          features: [
            'Acesso inicial para avaliação',
            'Primeiro contato com o fluxo da plataforma',
            'Ideal antes de avançar para um plano maior',
          ],
        },
        {
          name: 'Base',
          price: 'A partir de US$ 79 / mês',
          detail: 'Para equipes que estão começando a organizar acesso, documentos e rastreabilidade.',
          features: [
            'Capacidade inicial para começar a operar',
            'Limites pensados para as primeiras etapas',
            'Base pronta para crescer com a organização',
          ],
        },
        {
          name: 'Growth',
          price: 'A partir de US$ 149 / mês',
          detail: 'Para organizações em crescimento que precisam de mais volume e mais controle.',
          features: [
            'Mais espaço para equipes e operações',
            'Mais volume para documentos e evidências',
            'Preparado para operações mais exigentes',
          ],
        },
        {
          name: 'Business',
          price: 'A partir de US$ 299 / mês',
          detail: 'Para empresas que precisam de mais escala, controles mais fortes e operação contínua.',
          features: [
            'Mais capacidade para equipes, arquivos e vaults',
            'Mais margem para auditoria e continuidade',
            'Pronto para operações com maior exigência',
          ],
        },
        {
          name: 'Custom',
          price: 'Sob medida',
          detail: 'Para organizações com necessidades específicas, maior volume ou modelos operacionais especiais.',
          features: [
            'Configuração adaptada ao negócio',
            'Limites e capacidades sob medida',
            'Acompanhamento para necessidades específicas',
          ],
        },
      ],
      apiAddons: {
        title: 'Pacotes de API para integrações',
        description:
          'O plano base cobre o workspace. Se sua equipe precisar integrar a Sytadel em aplicações próprias, o acesso programático pode ser adicionado separadamente.',
        packages: [
          {
            name: 'Auth API Pack',
            availability: 'Disponível no Business',
            description:
              'Use a Sytadel como sistema de autenticação em produtos, portais ou ferramentas internas.',
            features: [
              'Login, sessões e tenants para suas apps',
              'Gestão de usuários e memberships',
              'Pack base exigido para habilitar Vault API e Zero Trust API',
              'Ideal para centralizar autenticação em sistemas próprios',
            ],
          },
          {
            name: 'Vault API Pack',
            availability: 'Disponível no Business',
            description:
              'Opere o Vault a partir dos seus sistemas com acesso programático protegido.',
            features: [
              'Acesso programático ao Vault',
              'Todo o tráfego passa por Zero Trust',
              'Requer Auth API Pack ativo',
              'Pensado para fluxos documentais protegidos',
            ],
          },
          {
            name: 'Zero Trust API Pack',
            availability: 'Disponível no Business',
            description:
              'Exponha políticas, upstreams e controles avançados para integrações mais exigentes.',
            features: [
              'Capacidades avançadas de Zero Trust',
              'Mais flexibilidade para integrações',
              'Requer Auth API Pack ativo',
              'Ideal para operações produtivas maiores',
            ],
          },
        ],
      },
    },
    cta: {
      title: 'Vamos mostrar onde hoje vocês perdem controle, tempo ou confiança.',
      description:
        'Podemos preparar uma demo focada em como a Sytadel reduz atrito, melhora rastreabilidade e torna mais defensáveis as decisões operacionais do dia a dia.',
      primary: 'Agendar demo',
      secondary: 'Ver módulos',
    },
    demo: {
      kicker: 'Como funciona',
      title: 'Veja o agente em ação.',
      description:
        'Uma animação de uma sessão real: o agente usa as mesmas ferramentas que o servidor MCP da Sytadel expõe, sobre um tenant de demonstração. Veja qual ferramenta ele chama e o que retorna — access review, políticas, notarização. Sem instalar nada.',
      disclaimer:
        'Animação com dados de demonstração — mostra o fluxo real, sem chamadas ao vivo nem custo.',
      placeholder: 'Pergunte sobre usuários, anomalias ou o estado de acesso…',
      send: 'Enviar',
      thinking: 'O agente está pensando…',
      reset: 'Reproduzir',
      toolLabel: 'Ferramenta',
      resultLabel: 'Resultado',
      errorGeneric: 'A demo não conseguiu responder isso. Tente novamente.',
      errorUnavailable:
        'A demo ao vivo não está disponível neste ambiente. Fale conosco para uma demo privada.',
      suggestions: [
        'Quem tem acesso em excesso neste tenant?',
        'Rode uma revisão de acesso e mostre os achados críticos.',
        'Mostre as anomalias de sessão recentes.',
        'Compile uma policy: OWNER pode tudo, MEMBER só GET /vaults, default deny.',
      ],
    },
    footer: 'Sytadel Labs. Acesso seguro, identidade e zero trust operacional para infraestrutura moderna.',
  },
};
