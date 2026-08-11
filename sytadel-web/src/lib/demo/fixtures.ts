/**
 * Seed data for the public, read-only "try it" demo tenant.
 *
 * This is a curated sandbox — NOT a live Sytadel backend. The shapes mirror
 * what `@sytadel/mcp-server` returns from the real APIs so the demo exercises
 * the same tools a connected Claude would call, but the data is fictional and
 * internally consistent (the dormant OWNER, the passkey-less admin, and the
 * stale service account below are exactly what the access review flags).
 */

export const DEMO_TENANT = {
  id: 'demo-tenant',
  name: 'Northwind Labs (demo)',
  slug: 'northwind-demo',
} as const;

export type DemoUser = {
  email: string;
  role: 'OWNER' | 'ADMIN' | 'MEMBER';
  isActive: boolean;
  passkeys: number;
  lastLoginAt: string | null;
};

export const DEMO_USERS: DemoUser[] = [
  {
    email: 'ana.owner@northwind.dev',
    role: 'OWNER',
    isActive: true,
    passkeys: 2,
    lastLoginAt: '2026-08-09T14:20:00Z',
  },
  {
    email: 'carlos.founder@northwind.dev',
    role: 'OWNER',
    isActive: true,
    passkeys: 1,
    lastLoginAt: '2026-02-11T09:05:00Z', // dormant OWNER — ~6 months idle
  },
  {
    email: 'priya.admin@northwind.dev',
    role: 'ADMIN',
    isActive: true,
    passkeys: 0, // no passkey — password-only admin
    lastLoginAt: '2026-08-08T18:44:00Z',
  },
  {
    email: 'diego.ops@northwind.dev',
    role: 'ADMIN',
    isActive: true,
    passkeys: 3,
    lastLoginAt: '2026-08-10T07:32:00Z',
  },
  {
    email: 'lucia.dev@northwind.dev',
    role: 'MEMBER',
    isActive: true,
    passkeys: 2,
    lastLoginAt: '2026-08-09T21:10:00Z',
  },
  {
    email: 'tom.contractor@northwind.dev',
    role: 'MEMBER',
    isActive: false, // deactivated contractor still on the roster
    passkeys: 1,
    lastLoginAt: '2026-05-30T12:00:00Z',
  },
];

export type DemoServiceAccount = {
  clientApp: string;
  name: string;
  lastUsedAt: string | null;
  autoRotate: boolean;
};

export const DEMO_SERVICE_ACCOUNTS: DemoServiceAccount[] = [
  {
    clientApp: 'billing-sync',
    name: 'stripe-webhook-consumer',
    lastUsedAt: '2026-08-10T06:00:00Z',
    autoRotate: true,
  },
  {
    clientApp: 'ci-pipeline',
    name: 'github-actions-deployer',
    lastUsedAt: '2026-08-09T23:41:00Z',
    autoRotate: true,
  },
  {
    clientApp: 'legacy-etl',
    name: 'nightly-report-exporter',
    lastUsedAt: '2026-01-18T03:00:00Z', // dormant ~7 months
    autoRotate: false, // never rotated
  },
  {
    clientApp: 'mobile-gateway',
    name: 'push-notification-sender',
    lastUsedAt: '2026-08-10T05:12:00Z',
    autoRotate: false,
  },
];

export type DemoAnomaly = {
  type:
    | 'login_new_ip'
    | 'login_new_country'
    | 'login_new_device'
    | 'high_score';
  score: number;
  ip: string;
  country: string;
  at: string;
  user: string;
};

export const DEMO_ANOMALIES: DemoAnomaly[] = [
  {
    type: 'login_new_country',
    score: 0.91,
    ip: '203.0.113.42',
    country: 'SG',
    at: '2026-08-10T02:14:00Z',
    user: 'priya.admin@northwind.dev',
  },
  {
    type: 'high_score',
    score: 0.87,
    ip: '198.51.100.9',
    country: 'US',
    at: '2026-08-09T22:58:00Z',
    user: 'carlos.founder@northwind.dev',
  },
  {
    type: 'login_new_device',
    score: 0.64,
    ip: '192.0.2.71',
    country: 'AR',
    at: '2026-08-09T19:30:00Z',
    user: 'lucia.dev@northwind.dev',
  },
  {
    type: 'login_new_ip',
    score: 0.52,
    ip: '192.0.2.15',
    country: 'AR',
    at: '2026-08-09T08:12:00Z',
    user: 'diego.ops@northwind.dev',
  },
];

/**
 * A representative compiled PolicySet. `generate_policy` normally calls the
 * Zero Trust policy compiler (an LLM step); in the demo we return a stable,
 * realistic result so visitors see the shape without incurring a second model
 * call. The `intent` is echoed into the description for a personalised feel.
 */
export function demoPolicy(intent: string) {
  const trimmed = intent.trim().slice(0, 300);
  return {
    policy: {
      version: 1,
      defaultEffect: 'deny',
      description: `Compiled from intent: "${trimmed}"`,
      rules: [
        {
          effect: 'allow',
          actorTypeIn: ['USER'],
          roleIn: ['OWNER'],
          methods: ['*'],
          pathGlob: '/**',
        },
        {
          effect: 'allow',
          actorTypeIn: ['USER'],
          roleIn: ['ADMIN'],
          methods: ['GET', 'POST', 'PUT'],
          pathGlob: '/vaults/**',
        },
        {
          effect: 'allow',
          actorTypeIn: ['USER'],
          roleIn: ['MEMBER'],
          methods: ['GET'],
          pathGlob: '/vaults/**',
        },
      ],
    },
    warnings: [
      'MEMBER is read-only on /vaults; write intents were not detected in the request.',
      'Default effect is "deny" — any path not listed above is rejected.',
    ],
    cost: { usd: 0.0021 },
    tokens: { input: 512, output: 214 },
    latencyMs: 1830,
    applied: false,
  };
}

/**
 * A representative access-review report. In production `run_access_review`
 * triggers an LLM review over the live snapshot; the demo returns a fixed
 * report whose findings line up with the fixtures above.
 */
export const DEMO_ACCESS_REVIEW = {
  tenantId: DEMO_TENANT.id,
  generatedAt: '2026-08-10T08:00:00Z',
  model: 'claude-sonnet-5',
  reportMarkdown: `## Access review — Northwind Labs (demo)

**Scope:** 6 users, 4 service accounts, 4 recent session anomalies.

### Findings
1. **Dormant OWNER** — \`carlos.founder@northwind.dev\` has not signed in for ~6 months yet still holds full OWNER privileges. High blast radius if the account is compromised.
2. **Password-only ADMIN** — \`priya.admin@northwind.dev\` has **0 passkeys** and just triggered a high-score login from a new country (SG, 0.91). Phishing-resistant MFA is missing on a privileged account.
3. **Stale service account** — \`legacy-etl / nightly-report-exporter\` last ran ~7 months ago and has **auto-rotation disabled**. A long-lived, unused secret.
4. **Deactivated user still listed** — \`tom.contractor@northwind.dev\` is inactive but remains a tenant member.

### Posture
Two of three privilege issues concentrate on the OWNER/ADMIN tier — the right place to spend review effort first.`,
  recommendations: [
    {
      type: 'downgrade',
      subject: 'carlos.founder@northwind.dev',
      rationale: 'Dormant ~6 months; downgrade OWNER→MEMBER or disable.',
      severity: 'high',
    },
    {
      type: 'require_password_reset',
      subject: 'priya.admin@northwind.dev',
      rationale: 'Privileged account with no passkey + high-score new-country login.',
      severity: 'high',
    },
    {
      type: 'rotate_service_account_secret',
      subject: 'legacy-etl / nightly-report-exporter',
      rationale: 'Auto-rotation off and dormant ~7 months.',
      severity: 'medium',
    },
    {
      type: 'disable_service_account',
      subject: 'legacy-etl / nightly-report-exporter',
      rationale: 'Unused for 7 months; disable if the ETL is retired.',
      severity: 'medium',
    },
    {
      type: 'review_manually',
      subject: 'tom.contractor@northwind.dev',
      rationale: 'Inactive contractor still on the roster; confirm off-boarding.',
      severity: 'low',
    },
  ],
} as const;
