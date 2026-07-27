import { NextRequest, NextResponse } from 'next/server';

const ACCESS_COOKIE = 'sentinel_access_token';
const REFRESH_COOKIE = 'sentinel_refresh_token';
const TENANT_ID_COOKIE = 'sentinel_tenant_id';
const TENANT_SLUG_COOKIE = 'sentinel_tenant_slug';

const AUTH_API_URL =
  process.env.AUTH_API_URL ?? 'http://localhost:3002/api';

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
      'user-agent': request.headers.get('user-agent') ?? 'sentinel-app-middleware',
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
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-pathname', request.nextUrl.pathname);

  if (!request.nextUrl.pathname.startsWith('/app')) {
    return NextResponse.next({
      request: { headers: requestHeaders },
    });
  }

  const accessToken = request.cookies.get(ACCESS_COOKIE)?.value;
  const refreshToken = request.cookies.get(REFRESH_COOKIE)?.value;

  if (!accessToken && !refreshToken) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  const exp = getJwtExpiry(accessToken);
  const now = Math.floor(Date.now() / 1000);
  const shouldRefresh =
    !accessToken || !exp || exp - now < 45;

  if (!shouldRefresh) {
    return NextResponse.next({
      request: { headers: requestHeaders },
    });
  }

  const rotated = await refreshSession(request);
  if (!rotated) {
    const response = NextResponse.redirect(new URL('/login', request.url));
    response.cookies.delete(ACCESS_COOKIE);
    response.cookies.delete(REFRESH_COOKIE);
    response.cookies.delete(TENANT_ID_COOKIE);
    response.cookies.delete(TENANT_SLUG_COOKIE);
    return response;
  }

  const response = NextResponse.next({
    request: { headers: requestHeaders },
  });
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
  matcher: ['/app/:path*'],
};
