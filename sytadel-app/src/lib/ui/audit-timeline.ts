import type {
  AuditCategory,
  AuditEventRecord,
  AuditOutcome,
  AuditSystem,
} from '@/lib/server/types/audit-event.type';
import type { TenantPolicyVersion } from '@/lib/server/types/policy.type';

/** A single row in the unified audit timeline, normalized across sources. */
export type TimelineEvent = {
  key: string;
  system: AuditSystem;
  category: AuditCategory;
  action: string;
  actorId: string | null;
  outcome: AuditOutcome;
  detail: string;
  occurredAt: string;
};

/** Vault's audit log predates the normalized shape, so it is adapted here. */
export type VaultAuditLogItem = {
  id: string;
  createdAt: string;
  action: string;
  httpPath?: string | null;
  httpMethod?: string | null;
  httpStatus?: number | null;
  resourceType?: string | null;
  resourceId?: string | null;
  userId?: string | null;
  outcome: 'SUCCESS' | 'FAILURE' | string;
};

function summarizeDetail(detail: Record<string, unknown> | null): string {
  if (!detail) return '';
  return Object.entries(detail)
    .filter(([, value]) => value != null && value !== '')
    .map(([key, value]) => `${key}: ${String(value)}`)
    .join(' · ');
}

export function fromAuditEvent(record: AuditEventRecord): TimelineEvent {
  return {
    key: `${record.system}:${record.id}`,
    system: record.system,
    category: record.category,
    action: record.action,
    actorId: record.actorId,
    outcome: record.outcome,
    detail: summarizeDetail(record.detail),
    occurredAt: record.occurredAt,
  };
}

export function fromVaultLog(item: VaultAuditLogItem): TimelineEvent {
  const method = item.httpMethod ?? '';
  const path = item.httpPath ?? '';
  const status = item.httpStatus != null ? ` (${item.httpStatus})` : '';
  return {
    key: `vault:${item.id}`,
    system: 'vault',
    category: 'access',
    action: item.action,
    actorId: item.userId ?? null,
    outcome: item.outcome === 'SUCCESS' ? 'success' : 'failure',
    detail: `${method} ${path}${status}`.trim(),
    occurredAt: item.createdAt,
  };
}

export function fromPolicyVersion(version: TenantPolicyVersion): TimelineEvent {
  const rules = version.policySet?.rules?.length ?? 0;
  const fallback = version.policySet?.default ?? '—';
  return {
    key: `policy:${version.id}`,
    system: 'zerotrust',
    category: 'config',
    action: 'POLICY_PUBLISHED',
    actorId: version.createdBy,
    outcome: 'success',
    detail: `v${version.version} · ${rules} reglas · default ${fallback}`,
    occurredAt: version.createdAt,
  };
}

/** Merge every source into one timeline, newest first, capped for the view. */
export function mergeTimeline(
  sources: TimelineEvent[][],
  limit = 100,
): TimelineEvent[] {
  return sources
    .flat()
    .sort(
      (a, b) =>
        new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime(),
    )
    .slice(0, limit);
}
