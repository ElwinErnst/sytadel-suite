import type { CapabilityMap, SessionState } from './types';

export function getCapabilities(
  session: SessionState,
  context?: { vaultCount?: number },
): CapabilityMap {
  const role = session.roles[0] ?? 'MEMBER';
  const entitlements = session.tenant.entitlements;
  const normalizedPlan = (entitlements.planCode ?? session.tenant.planCode ?? 'FREE').toUpperCase();
  const vaultFeaturesEnabled = entitlements.features.vaults;
  const ztPoliciesEnabled = entitlements.features.ztPolicies;
  const configuredMaxVaults = entitlements.limits.maxVaults;

  const isOwner = role === 'OWNER';
  const isAdmin = role === 'ADMIN';
  const canOperate = isOwner || isAdmin;
  const canReadDocumentsByRole = canOperate || role === 'MEMBER';
  const canUploadDocumentsByRole = canOperate;
  const currentVaultCount = context?.vaultCount ?? 0;
  const hasVaultCapacity =
    configuredMaxVaults == null || currentVaultCount < configuredMaxVaults;

  return {
    canManageMembers: canOperate,
    canManageMembersByRole: canOperate,
    canCreateVaultByRole: canOperate,
    canCreateVault: canOperate && vaultFeaturesEnabled && hasVaultCapacity,
    canDeleteVaultByRole: canOperate,
    canDeleteVault: canOperate && vaultFeaturesEnabled,
    canUploadDocumentsByRole,
    canUploadDocuments: canUploadDocumentsByRole && vaultFeaturesEnabled,
    canDownloadDocumentsByRole: canReadDocumentsByRole,
    canDownloadDocuments: canReadDocumentsByRole && vaultFeaturesEnabled,
    canDeleteDocumentsByRole: canOperate,
    canDeleteDocuments: canOperate && vaultFeaturesEnabled,
    canUseAdvancedSecurity:
      ztPoliciesEnabled &&
      (normalizedPlan === 'GROWTH' ||
        normalizedPlan === 'BUSINESS' ||
        normalizedPlan === 'ENTERPRISE'),
    vaultFeaturesEnabled,
    ztPoliciesEnabled,
    hasVaultCapacity,
    maxVaults: configuredMaxVaults,
  };
}
