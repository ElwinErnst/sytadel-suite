/**
 * Demo mirror of the `@sytadel/mcp-server` tool registry. Same names,
 * descriptions and input schemas the real MCP server exposes over stdio — so a
 * visitor sees Claude call exactly the tools it would call when connected — but
 * the handlers read from the local fixture tenant instead of hitting live APIs.
 *
 * Kept intentionally in sync by hand: the tool set is small and stable, and
 * duplicating it here keeps sytadel-web deployable as a standalone static site
 * without pulling the MCP server package into the Vercel build.
 */
import {
  DEMO_ACCESS_REVIEW,
  DEMO_ANOMALIES,
  DEMO_SERVICE_ACCOUNTS,
  DEMO_USERS,
  demoPolicy,
} from './fixtures';

export type DemoTool = {
  name: string;
  description: string;
  input_schema: {
    type: 'object';
    properties: Record<string, unknown>;
    required?: string[];
    additionalProperties: false;
  };
  run: (input: Record<string, unknown>) => unknown;
};

export const DEMO_TOOLS: DemoTool[] = [
  {
    name: 'list_tenant_users',
    description:
      'List all users of the current Sytadel tenant with their role, active flag, passkey count, and last login. Useful for access reviews and off-boarding checks.',
    input_schema: { type: 'object', properties: {}, additionalProperties: false },
    run: () => DEMO_USERS,
  },
  {
    name: 'list_service_accounts',
    description:
      'List service accounts (machine credentials) under every client app of the current tenant, with last-used timestamps and auto-rotation state. Useful for spotting dormant integrations.',
    input_schema: { type: 'object', properties: {}, additionalProperties: false },
    run: () => DEMO_SERVICE_ACCOUNTS,
  },
  {
    name: 'query_session_anomalies',
    description:
      'Return recent session anomaly events (login from new IP / new country / new device / high score) for the tenant, up to `limit` rows. Ordered newest first.',
    input_schema: {
      type: 'object',
      properties: {
        limit: {
          type: 'integer',
          minimum: 1,
          maximum: 200,
          description: 'Max rows to return (default 50).',
        },
      },
      additionalProperties: false,
    },
    run: (input) => {
      const limit = clampLimit(input.limit, 50);
      return DEMO_ANOMALIES.slice(0, limit);
    },
  },
  {
    name: 'generate_policy',
    description:
      'Compile a natural-language RBAC intent (e.g. "OWNER can do anything, MEMBER can only GET /vaults, default deny") into a Sytadel PolicySet JSON. Returns policy, warnings, cost, tokens, latency. Read-only: the compiled policy is NOT applied.',
    input_schema: {
      type: 'object',
      properties: {
        intent: {
          type: 'string',
          minLength: 3,
          maxLength: 1000,
          description: 'The RBAC intent in plain language.',
        },
      },
      required: ['intent'],
      additionalProperties: false,
    },
    run: (input) => demoPolicy(String(input.intent ?? '')),
  },
  {
    name: 'run_access_review',
    description:
      'Trigger an on-demand AI-driven access review for the current tenant. Claude reviews users, service accounts and recent anomalies, and returns a markdown report plus a machine-readable list of recommendations (revoke, downgrade, disable_service_account, rotate_service_account_secret, delete_passkey, require_password_reset, review_manually).',
    input_schema: { type: 'object', properties: {}, additionalProperties: false },
    run: () => DEMO_ACCESS_REVIEW,
  },
];

function clampLimit(raw: unknown, fallback: number): number {
  const n = Number(raw);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(200, Math.max(1, Math.trunc(n)));
}

export function findDemoTool(name: string): DemoTool | undefined {
  return DEMO_TOOLS.find((t) => t.name === name);
}
