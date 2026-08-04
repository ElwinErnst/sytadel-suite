import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { env } from './env';
import { ApiError, requestJson } from './http';
import type { CookieStore } from './types/cookie-store.type';
import type { SessionState, TenantSummary, TokenPair } from './types';

export const ACCESS_COOKIE = 'sentinel_access_token';
export const REFRESH_COOKIE = 'sentinel_refresh_token';
export const TENANT_ID_COOKIE = 'sentinel_tenant_id';
export const TENANT_SLUG_COOKIE = 'sentinel_tenant_slug';

export async function getCookieStore() {
  return cookies();
}

export async function setSessionCookies(
  cookieStore: CookieStore,
  tokenPair: TokenPair,
  tenant: { id: string; slug: string },
) {
  const secure = env.nodeEnv === 'production';

  cookieStore.set(ACCESS_COOKIE, tokenPair.accessToken, {
    httpOnly: true,
    sameSite: 'lax',
    secure,
    path: '/',
  });
  cookieStore.set(REFRESH_COOKIE, tokenPair.refreshToken, {
    httpOnly: true,
    sameSite: 'lax',
    secure,
    path: '/',
  });
  cookieStore.set(TENANT_ID_COOKIE, tenant.id, {
    httpOnly: true,
    sameSite: 'lax',
    secure,
    path: '/',
  });
  cookieStore.set(TENANT_SLUG_COOKIE, tenant.slug, {
    httpOnly: true,
    sameSite: 'lax',
    secure,
    path: '/',
  });
}

export async function clearSessionCookies(cookieStore?: CookieStore) {
  const store = cookieStore ?? (await getCookieStore());
  store.delete(ACCESS_COOKIE);
  store.delete(REFRESH_COOKIE);
  store.delete(TENANT_ID_COOKIE);
  store.delete(TENANT_SLUG_COOKIE);
}

export async function getTokenSnapshot() {
  const cookieStore = await getCookieStore();

  return {
    accessToken: cookieStore.get(ACCESS_COOKIE)?.value,
    refreshToken: cookieStore.get(REFRESH_COOKIE)?.value,
    tenantId: cookieStore.get(TENANT_ID_COOKIE)?.value,
    tenantSlug: cookieStore.get(TENANT_SLUG_COOKIE)?.value,
  };
}

export async function refreshSessionOrThrow(cookieStore?: CookieStore) {
  const store = cookieStore ?? (await getCookieStore());
  const refreshToken = store.get(REFRESH_COOKIE)?.value;
  const tenantId = store.get(TENANT_ID_COOKIE)?.value;
  const tenantSlug = store.get(TENANT_SLUG_COOKIE)?.value;

  if (!refreshToken || !tenantId || !tenantSlug) {
    throw new ApiError('Missing session context', 401);
  }

  const tokenPair = await requestJson<TokenPair>(`${env.authApiUrl}/auth/refresh`, {
    method: 'POST',
    body: { refreshToken },
  });

  await setSessionCookies(store, tokenPair, {
    id: tenantId,
    slug: tenantSlug,
  });

  return tokenPair.accessToken;
}

export async function getServerAccessTokenOrRedirect() {
  const { accessToken } = await getTokenSnapshot();
  if (!accessToken) redirect('/login');
  return accessToken;
}

export async function withSessionToken<T>(
  run: (token: string, cookieStore: CookieStore) => Promise<T>,
) {
  const cookieStore = await getCookieStore();
  let accessToken = cookieStore.get(ACCESS_COOKIE)?.value;

  if (!accessToken) {
    accessToken = await refreshSessionOrThrow(cookieStore);
  }

  try {
    return await run(accessToken, cookieStore);
  } catch (error) {
    if (!(error instanceof ApiError) || error.status !== 401) {
      throw error;
    }

    const rotated = await refreshSessionOrThrow(cookieStore);
    return run(rotated, cookieStore);
  }
}

export async function getCurrentSession(): Promise<SessionState | null> {
  const { accessToken, tenantId } = await getTokenSnapshot();
  if (!accessToken || !tenantId) return null;

  try {
    const me = await requestJson<{
      user: SessionState['user'];
      tenant: {
        id: string;
        name: string;
        slug: string;
        planCode: string | null;
        billingBypass?: boolean;
        entitlements: SessionState['tenant']['entitlements'];
      };
      roles: SessionState['roles'];
      sessionId: string | null;
    }>(`${env.authApiUrl}/auth/me`, {
      method: 'GET',
      token: accessToken,
    });

    const tenant = await requestJson<TenantSummary>(`${env.authApiUrl}/tenants/${tenantId}`, {
      method: 'GET',
      token: accessToken,
    });

    return {
      user: me.user,
      tenant: {
        id: tenant.id,
        name: tenant.name,
        slug: tenant.slug,
        planCode: tenant.planCode ?? me.tenant.planCode,
        billingBypass: tenant.billingBypass ?? me.tenant.billingBypass,
        entitlements: tenant.entitlements ?? me.tenant.entitlements,
        ztPoliciesEnabled:
          tenant.entitlements?.features.ztPolicies ??
          me.tenant.entitlements.features.ztPolicies,
        vaultsEnabled:
          tenant.entitlements?.features.vaults ??
          me.tenant.entitlements.features.vaults,
        maxVaults:
          tenant.entitlements?.limits.maxVaults ??
          me.tenant.entitlements.limits.maxVaults,
        isActive: tenant.isActive,
      },
      roles: me.roles,
      sessionId: me.sessionId,
    };
  } catch {
    return null;
  }
}

export async function requireSession() {
  const session = await getCurrentSession();
  if (!session) redirect('/login');
  return session;
}

export async function requireOperationalSession() {
  const session = await requireSession();

  if (session.tenant.isActive) {
    return session;
  }

  if (session.roles.includes('OWNER')) {
    redirect('/app/settings?message=La%20organizacion%20esta%20inactiva.%20Reactivala%20desde%20Configuracion%20para%20retomar%20la%20operacion.');
  }

  await clearSessionCookies();
  redirect('/login?error=La%20organizacion%20esta%20inactiva.%20Contacta%20a%20una%20cuenta%20OWNER%20para%20reactivarla.');
}
