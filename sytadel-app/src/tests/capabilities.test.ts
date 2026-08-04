import { describe, expect, it } from 'vitest';
import { getCapabilities } from '@/lib/server/capabilities';
import type { SessionState } from '@/lib/server/types';

function buildSession(overrides?: Partial<SessionState>): SessionState {
  return {
    user: {
      id: 'user-1',
      email: 'admin@test.com',
      firstName: 'Admin',
      lastName: 'Demo',
    },
    tenant: {
      id: 'tenant-1',
      name: 'Sytadel Labs',
      slug: 'sentinel-labs',
      planCode: 'FREE',
      entitlements: {
        planCode: 'FREE',
        features: {
          vaults: true,
          ztPolicies: false,
          digitalNotary: false,
          auditExport: false,
          customBranding: false,
          sso: false,
        },
        limits: {
          maxVaults: 3,
          maxUsers: 3,
          auditRetentionDays: 30,
          monthlyNotaryRequests: 0,
        },
        addonsAllowed: [],
        source: 'catalog',
      },
      ztPoliciesEnabled: false,
      vaultsEnabled: true,
      maxVaults: 3,
      isActive: true,
    },
    roles: ['OWNER'],
    sessionId: 'session-1',
    ...overrides,
  };
}

describe('getCapabilities', () => {
  it('habilita operaciones base para owner en free', () => {
    const capabilities = getCapabilities(buildSession(), { vaultCount: 1 });

    expect(capabilities.canManageMembers).toBe(true);
    expect(capabilities.canManageMembersByRole).toBe(true);
    expect(capabilities.canCreateVault).toBe(true);
    expect(capabilities.canCreateVaultByRole).toBe(true);
    expect(capabilities.canDeleteVault).toBe(true);
    expect(capabilities.canUploadDocuments).toBe(true);
    expect(capabilities.canDownloadDocuments).toBe(true);
    expect(capabilities.canUseAdvancedSecurity).toBe(false);
  });

  it('bloquea creación de vaults al superar el límite del plan', () => {
    const capabilities = getCapabilities(buildSession(), { vaultCount: 3 });
    expect(capabilities.canCreateVault).toBe(false);
    expect(capabilities.hasVaultCapacity).toBe(false);
    expect(capabilities.maxVaults).toBe(3);
  });

  it('reduce capacidades para member', () => {
    const capabilities = getCapabilities(
      buildSession({
        roles: ['MEMBER'],
        tenant: {
          ...buildSession().tenant,
          planCode: 'BUSINESS',
          entitlements: {
            ...buildSession().tenant.entitlements,
            planCode: 'BUSINESS',
            features: {
              ...buildSession().tenant.entitlements.features,
              ztPolicies: true,
              digitalNotary: true,
              auditExport: true,
              customBranding: true,
            },
            limits: {
              ...buildSession().tenant.entitlements.limits,
              maxVaults: 10,
              maxUsers: 50,
              auditRetentionDays: 365,
              monthlyNotaryRequests: 1000,
            },
            addonsAllowed: ['extra_vaults'],
            source: 'catalog',
          },
          ztPoliciesEnabled: true,
          maxVaults: 10,
        },
      }),
      { vaultCount: 1 },
    );

    expect(capabilities.canManageMembers).toBe(false);
    expect(capabilities.canManageMembersByRole).toBe(false);
    expect(capabilities.canDeleteVault).toBe(false);
    expect(capabilities.canUploadDocumentsByRole).toBe(false);
    expect(capabilities.canUploadDocuments).toBe(false);
    expect(capabilities.canDownloadDocuments).toBe(true);
    expect(capabilities.canUseAdvancedSecurity).toBe(true);
  });

  it('mantiene visible pero deshabilitado lo bloqueado por política de sesión', () => {
    const capabilities = getCapabilities(
      buildSession({
        roles: ['ADMIN'],
        tenant: {
          ...buildSession().tenant,
          planCode: 'ENTERPRISE',
          entitlements: {
            ...buildSession().tenant.entitlements,
            planCode: 'ENTERPRISE',
            features: {
              ...buildSession().tenant.entitlements.features,
              vaults: false,
              ztPolicies: false,
              digitalNotary: true,
              auditExport: true,
              customBranding: true,
              sso: true,
            },
            limits: {
              ...buildSession().tenant.entitlements.limits,
              maxVaults: null,
              maxUsers: null,
              auditRetentionDays: null,
              monthlyNotaryRequests: null,
            },
            addonsAllowed: ['extra_vaults', 'dedicated_support'],
            source: 'catalog_with_legacy_overrides',
          },
          vaultsEnabled: false,
          ztPoliciesEnabled: false,
          maxVaults: null,
        },
      }),
      { vaultCount: 1 },
    );

    expect(capabilities.canCreateVaultByRole).toBe(true);
    expect(capabilities.canCreateVault).toBe(false);
    expect(capabilities.canDownloadDocumentsByRole).toBe(true);
    expect(capabilities.canDownloadDocuments).toBe(false);
    expect(capabilities.canUseAdvancedSecurity).toBe(false);
    expect(capabilities.vaultFeaturesEnabled).toBe(false);
  });
});
