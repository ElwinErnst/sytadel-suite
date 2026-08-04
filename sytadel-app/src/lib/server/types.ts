export type TenantRole = 'OWNER' | 'ADMIN' | 'MEMBER';

export type TokenPair = {
  accessToken: string;
  refreshToken: string;
  accessTokenExpiresIn: number;
  refreshTokenExpiresIn: number;
};

export type SessionUser = {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
};

export type TenantEntitlements = {
  planCode: string;
  features: {
    vaults: boolean;
    ztPolicies: boolean;
    digitalNotary: boolean;
    auditExport: boolean;
    customBranding: boolean;
    sso: boolean;
    apiAuth: boolean;
    apiVault: boolean;
    apiZeroTrust: boolean;
  };
  limits: {
    maxVaults: number | null;
    maxUsers: number | null;
    auditRetentionDays: number | null;
    monthlyNotaryRequests: number | null;
    maxClientApps: number | null;
    maxServiceAccounts: number | null;
  };
  addonsAllowed: string[];
  apiAddons: BillingApiAddonCode[];
  source:
    | 'catalog'
    | 'catalog_with_legacy_overrides'
    | 'legacy_defaults'
    | 'billing_bypass';
};

export type SessionTenant = {
  id: string;
  name: string;
  slug: string;
  planCode: string | null;
  billingBypass?: boolean;
  entitlements: TenantEntitlements;
  ztPoliciesEnabled: boolean;
  vaultsEnabled: boolean;
  maxVaults: number | null;
  isActive: boolean;
};

export type SessionState = {
  user: SessionUser;
  tenant: SessionTenant;
  roles: TenantRole[];
  sessionId: string | null;
};

export type TenantSummary = {
  id: string;
  name: string;
  slug: string;
  planCode: string | null;
  billingBypass?: boolean;
  entitlements: TenantEntitlements;
  ztPoliciesEnabled: boolean;
  vaultsEnabled: boolean;
  maxVaults: number | null;
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;
};

export type MembershipUser = {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
};

export type MembershipRecord = {
  id: string;
  userId: string;
  tenantId: string;
  role: TenantRole;
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;
  user?: MembershipUser;
  tenant?: {
    id: string;
    name: string;
    slug: string;
    planCode?: string | null;
    isActive?: boolean;
  };
};

export type ClientAppRecord = {
  id: string;
  tenantId: string;
  name: string;
  slug: string;
  description: string | null;
  createdByUserId: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  serviceAccounts?: ServiceAccountRecord[];
};

export type ServiceAccountRecord = {
  id: string;
  tenantId: string;
  clientAppId: string;
  name: string;
  description: string | null;
  secretPreview: string;
  createdByUserId: string | null;
  isActive: boolean;
  lastUsedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type CreatedServiceAccountRecord = {
  serviceAccount: ServiceAccountRecord;
  clientSecret: string;
};

export type VaultRecord = {
  id: string;
  tenantId: string;
  name: string;
  slug: string;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
};

export type DocumentRecord = {
  id: string;
  tenantId: string;
  vaultId: string;
  originalName: string;
  storedName: string;
  mime: string;
  sizeBytes: number | string;
  createdAt: string;
  anchorStatus?: string | null;
  encAlg?: string | null;
};

export type AuditOutcome = 'SUCCESS' | 'FAILURE';

export type AuditRecord = {
  id: string;
  tenantId: string | null;
  userId: string | null;
  scope: string;
  seq: string;
  action: string;
  resourceType: string;
  resourceId: string | null;
  outcome: AuditOutcome;
  httpStatus: number;
  httpMethod: string;
  httpPath: string;
  ip: string | null;
  userAgent: string | null;
  metadata: Record<string, unknown> | null;
  eventHash: string;
  prevHash: string | null;
  chainHash: string;
  createdAt: string;
};

export type AuditSearchResult = {
  page: number;
  limit: number;
  total: number;
  items: AuditRecord[];
};

export type AuditSearchQuery = {
  action?: string;
  resourceType?: string;
  resourceId?: string;
  userId?: string;
  outcome?: AuditOutcome;
  from?: string;
  to?: string;
  page?: number;
  limit?: number;
};

export type VerifyDocumentResult = {
  status: 'VALID' | 'MODIFIED' | 'NOT_ANCHORED';
  documentId: string;
  storedSha256: string;
  currentSha256: string;
  anchorTxHash: string | null;
  anchoredAt: string | null;
};

export type CapabilityMap = {
  canManageMembers: boolean;
  canManageMembersByRole: boolean;
  canCreateVault: boolean;
  canCreateVaultByRole: boolean;
  canDeleteVault: boolean;
  canDeleteVaultByRole: boolean;
  canUploadDocuments: boolean;
  canUploadDocumentsByRole: boolean;
  canDownloadDocuments: boolean;
  canDownloadDocumentsByRole: boolean;
  canDeleteDocuments: boolean;
  canDeleteDocumentsByRole: boolean;
  canUseAdvancedSecurity: boolean;
  vaultFeaturesEnabled: boolean;
  ztPoliciesEnabled: boolean;
  hasVaultCapacity: boolean;
  maxVaults: number | null;
};

export type BillingIndustryCode =
  | 'GENERAL'
  | 'FINTECH'
  | 'GOVTECH'
  | 'HEALTHTECH'
  | 'LEGALTECH';

export type BillingTierCode = 'BASE' | 'GROWTH' | 'BUSINESS' | 'CUSTOM';
export type BillingApiAddonCode = 'AUTH_API' | 'VAULT_API' | 'ZERO_TRUST_API';

export type BillingCatalogIndustry = {
  code: BillingIndustryCode;
  name: string;
  description: string;
};

export type BillingCatalogTier = {
  code: BillingTierCode;
  name: string;
  description: string;
  selfServe: boolean;
};

export type BillingCatalogApiAddon = {
  code: BillingApiAddonCode;
  name: string;
  description: string;
  availableFromTier: BillingTierCode;
  monthlyPriceCents: number;
  yearlyPriceCents: number;
  features: string[];
  usageLimits: Array<{
    metric: string;
    label: string;
    included: number;
    unit: string;
    overageBlockSize: number;
    overageBlockPriceCents: number;
  }>;
};

export type BillingOfferLimits = {
  maxVaults: number | null;
  monthlyNotaryRequests: number | null;
  ztMode: 'basic' | 'advanced' | 'custom';
  maxFileSizeMb: number | null;
  maxVaultStorageGb: number | null;
  maxUsers: number | null;
};

export type BillingCatalogOffer = {
  industry: BillingIndustryCode;
  tier: BillingTierCode;
  name: string;
  description: string;
  monthlyPriceCents: number;
  yearlyPriceCents: number | null;
  selfServe: boolean;
  limits: BillingOfferLimits;
};

export type BillingCatalog = {
  industries: BillingCatalogIndustry[];
  tiers: BillingCatalogTier[];
  offers: BillingCatalogOffer[];
  apiAddons: BillingCatalogApiAddon[];
};

export type BillingCustomer = {
  id: string;
  tenantId: string;
  provider: string;
  providerCustomerId: string | null;
  billingEmail: string | null;
  companyName: string | null;
  createdAt: string;
  updatedAt: string;
};

export type BillingSubscription = {
  id: string;
  tenantId: string;
  provider: string;
  providerSubscriptionId: string | null;
  status: 'PENDING' | 'ACTIVE' | 'PAST_DUE' | 'CANCELED';
  basePlan: BillingTierCode;
  industryPackage: BillingIndustryCode | null;
  billingCycle: 'monthly' | 'yearly';
  seats: number;
  currency: string;
  amountCents: number;
  addonAmountCents: number;
  apiAddons: BillingApiAddonCode[] | null;
  checkoutUrl: string | null;
  currentPeriodEndsAt: string | null;
  trialEndsAt: string | null;
  activatedAt: string | null;
  cancelAtPeriodEnd: boolean;
  scheduledPlanCode: BillingTierCode | null;
  scheduledIndustryPackage: BillingIndustryCode | null;
  scheduledBillingCycle: 'monthly' | 'yearly' | null;
  scheduledSeats: number | null;
  scheduledApiAddons: BillingApiAddonCode[] | null;
  scheduledChangeEffectiveAt: string | null;
  dataDeletionDueAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type BillingUsageTotals = Record<string, Record<string, number>>;

export type BillingUsageEvent = {
  id: string;
  addonCode: BillingApiAddonCode;
  metric: string;
  quantity: number;
  sourceService: string;
  actorType: string | null;
  clientAppId: string | null;
  serviceAccountId: string | null;
  createdAt: string;
};

export type BillingUsageSummary = {
  windowStartedAt: string | null;
  totals: BillingUsageTotals;
  overages: Record<
    string,
    {
      estimatedExtraCents: number;
      metrics: Array<{
        metric: string;
        label: string;
        included: number;
        used: number;
        excess: number;
        overageBlocks: number;
        estimatedExtraCents: number;
        unit: string;
      }>;
    }
  >;
  recentEvents: BillingUsageEvent[];
};

export type BillingClosedPeriod = {
  id: string;
  subscriptionId: string;
  periodStartedAt: string;
  periodEndedAt: string;
  currency: string;
  baseAmountCents: number;
  addonAmountCents: number;
  overageAmountCents: number;
  totalAmountCents: number;
  summary: Record<string, unknown>;
  closedAt: string;
};

export type BillingOverview = {
  tenantId: string;
  customer: BillingCustomer | null;
  subscription: BillingSubscription | null;
  usage: BillingUsageSummary;
  recentPeriodClosures: BillingClosedPeriod[];
  provider: string;
  publishableKey: string | null;
  catalog: BillingCatalog;
};

export type BillingCheckoutSession = {
  provider: string;
  subscriptionId: string;
  checkoutUrl: string;
  amountCents: number;
  currency: string;
  summary: {
    tier: BillingTierCode;
    industry: BillingIndustryCode | null;
    billingCycle: 'monthly' | 'yearly';
    seats: number;
    addOns: BillingApiAddonCode[];
  };
  customer: BillingCustomer;
};

export type BillingPortalSession = {
  provider: string;
  url: string;
};
