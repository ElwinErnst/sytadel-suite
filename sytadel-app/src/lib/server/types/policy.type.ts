/**
 * Zero Trust policy types for the console. These mirror the Zod policy schema
 * owned by zerotrust-api (policy.schema.ts) and the TenantPolicyVersion entity
 * owned by auth-api (the source of truth). auth-api re-validates on publish and
 * zerotrust-api re-validates before evaluating, so the console only needs the
 * shape to build the editor — it does not re-implement validation.
 */

export const ZT_UPSTREAMS = ['vault', 'auth', 'billing'] as const;
export const ZT_HTTP_METHODS = [
  'GET',
  'POST',
  'PUT',
  'PATCH',
  'DELETE',
  'HEAD',
  'OPTIONS',
] as const;
export const ZT_ACTOR_TYPES = ['user', 'service_account'] as const;

export type ZtUpstream = (typeof ZT_UPSTREAMS)[number];
export type ZtHttpMethod = (typeof ZT_HTTP_METHODS)[number];
export type ZtActorType = (typeof ZT_ACTOR_TYPES)[number];

export type PolicyEffect = 'allow' | 'deny';

export type PolicyRule = {
  description: string;
  effect: PolicyEffect;
  when: {
    upstream: ZtUpstream;
    methods?: ZtHttpMethod[];
    pathGlob?: string;
  };
  if?: {
    roleIn?: string[];
    actorTypeIn?: ZtActorType[];
  };
  reason?: string;
};

export type PolicySet = {
  version: 1;
  rules: PolicyRule[];
  default: PolicyEffect;
};

/** A published/archived policy row as served by auth-api. */
export type TenantPolicyVersion = {
  id: string;
  tenantId: string;
  version: number;
  policySet: PolicySet;
  status: 'published' | 'archived';
  createdBy: string | null;
  createdAt: string;
};

/** Safe empty policy for a tenant that has never published one. Deny-by-default
 * is the correct Zero Trust stance for an unconfigured tenant. */
export const EMPTY_POLICY_SET: PolicySet = {
  version: 1,
  rules: [],
  default: 'deny',
};

export const MAX_POLICY_RULES = 50;
