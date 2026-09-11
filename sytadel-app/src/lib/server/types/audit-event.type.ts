/**
 * Normalized audit event as served by each backend service's /audit-events
 * endpoint (auth-api, zerotrust-api; billing and others to follow). The console
 * merges these plus adapted legacy sources (vault logs, policy versions) into
 * one timeline.
 */
export type AuditSystem = 'auth' | 'billing' | 'zerotrust' | 'vault';
export type AuditCategory = 'access' | 'config' | 'decision' | 'billing';
export type AuditOutcome = 'success' | 'failure' | 'allow' | 'deny';

export type AuditEventRecord = {
  id: string;
  tenantId: string;
  system: AuditSystem;
  category: AuditCategory;
  action: string;
  actorType: string | null;
  actorId: string | null;
  resourceType: string | null;
  resourceId: string | null;
  outcome: AuditOutcome;
  detail: Record<string, unknown> | null;
  occurredAt: string;
};

export type AuditEventsPage = {
  items: AuditEventRecord[];
  total: number;
  page: number;
  limit: number;
};
