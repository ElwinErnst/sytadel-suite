import { NextRequest, NextResponse } from 'next/server';

const ACCESS_COOKIE = 'sentinel_access_token';
const REFRESH_COOKIE = 'sentinel_refresh_token';
const TENANT_ID_COOKIE = 'sentinel_tenant_id';
const TENANT_SLUG_COOKIE = 'sentinel_tenant_slug';

const AUTH_API_URL = process.env.AUTH_API_URL ?? 'http://localhost:3002/api';

/**
 * Nonce-based Content-Security-Policy. A fresh nonce per request is stamped onto
 * the CSP and onto the request headers; Next applies it to its own scripts, and
 * the browser rejects any script not carrying it. `strict-dynamic` lets a
 * nonce'd script load its own dependencies without host allow-lists.
 *
 * connect-src is 'self': the browser only ever talks to this Next origin; the
 * backend APIs are called server-side (their URLs are server-only env vars).
 * style-src keeps 'unsafe-inline' — the framework/UI inject inline styles, and
 * styles carry far less XSS risk than scripts. Dev also allows 'unsafe-eval'
 * (React Refresh / source maps need it); production does not.
 */
function buildCsp(nonce: string, isDev: boolean): string {
  const scriptSrc = isDev
    ? `'self' 'nonce-${nonce}' 'strict-dynamic' 'unsafe-eval'`
    : `'self' 'nonce-${nonce}' 'strict-dynamic'`;

  return [
    `default-src 'self'`,
    `script-src ${scriptSrc}`,
    `style-src 'self' 'unsafe-inline'`,
    `img-src 'self' data: blob:`,
    `font-src 'self'`,
    `connect-src 'self'`,
    `frame-ancestors 'none'`,
    `base-uri 'self'`,
    `form-action 'self'`,
    `object-src 'none'`,
  ].join('; ');
}

function getJwtExpiry(token: string | undefined): number | null {
  if (!token) return null;

  const parts = token.split('.');
  if (parts.length !== 3) return null;

  try {
    const normalized = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=');
    const payload = JSON.parse(atob(padded)) as { exp?: number };

    return typeof payload.exp === 'number' ? payload.exp : null;
  } catch {
    return null;
  }
}

async function refreshSession(request: NextRequest) {
  const refreshToken = request.cookies.get(REFRESH_COOKIE)?.value;
  if (!refreshToken) return null;

  const response = await fetch(`${AUTH_API_URL}/auth/refresh`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'user-agent':
        request.headers.get('user-agent') ?? 'sytadel-app-middleware',
    },
    body: JSON.stringify({ refreshToken }),
    cache: 'no-store',
  });

  if (!response.ok) return null;

  const payload = (await response.json()) as {
    accessToken: string;
    refreshToken: string;
  };

  return payload;
}

export async function middleware(request: NextRequest) {
  // Edge runtime: no Buffer. btoa + crypto are available.
  const nonce = btoa(crypto.randomUUID());
  const csp = buildCsp(nonce, process.env.NODE_ENV !== 'production');

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-pathname', request.nextUrl.pathname);
  requestHeaders.set('x-nonce', nonce);
  // Next reads the CSP off the request to apply the nonce to its own scripts.
  requestHeaders.set('content-security-policy', csp);

  const nextWithCsp = () => {
    const response = NextResponse.next({
      request: { headers: requestHeaders },
    });
    response.headers.set('content-security-policy', csp);
    return response;
  };
  const redirectWithCsp = (url: URL) => {
    const response = NextResponse.redirect(url);
    response.headers.set('content-security-policy', csp);
    return response;
  };

  if (!request.nextUrl.pathname.startsWith('/app')) {
    return nextWithCsp();
  }

  const accessToken = request.cookies.get(ACCESS_COOKIE)?.value;
  const refreshToken = request.cookies.get(REFRESH_COOKIE)?.value;

  if (!accessToken && !refreshToken) {
    return redirectWithCsp(new URL('/login', request.url));
  }

  const exp = getJwtExpiry(accessToken);
  const now = Math.floor(Date.now() / 1000);
  const shouldRefresh = !accessToken || !exp || exp - now < 45;

  if (!shouldRefresh) {
    return nextWithCsp();
  }

  const rotated = await refreshSession(request);
  if (!rotated) {
    const response = redirectWithCsp(new URL('/login', request.url));
    response.cookies.delete(ACCESS_COOKIE);
    response.cookies.delete(REFRESH_COOKIE);
    response.cookies.delete(TENANT_ID_COOKIE);
    response.cookies.delete(TENANT_SLUG_COOKIE);
    return response;
  }

  const response = nextWithCsp();
  const secure = request.nextUrl.protocol === 'https:';

  response.cookies.set(ACCESS_COOKIE, rotated.accessToken, {
    httpOnly: true,
    sameSite: 'lax',
    secure,
    path: '/',
  });
  response.cookies.set(REFRESH_COOKIE, rotated.refreshToken, {
    httpOnly: true,
    sameSite: 'lax',
    secure,
    path: '/',
  });

  return response;
}

export const config = {
  // Run on everything except Next internals and static assets, so the CSP
  // covers every rendered page — not just /app.
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)',
  ],
};
