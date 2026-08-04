'use server';

import { redirect } from 'next/navigation';
import * as authClient from '@/lib/server/auth-client';
import {
  clearSessionCookies,
  getCookieStore,
  getTokenSnapshot,
  setSessionCookies,
} from '@/lib/server/session';

export async function loginAction(formData: FormData) {
  const email = String(formData.get('email') ?? '').trim();
  const password = String(formData.get('password') ?? '').trim();
  const tenantSlug = String(formData.get('tenantSlug') ?? '').trim();

  if (!email || !password || !tenantSlug) {
    redirect('/login?error=Completa email, password y tenant.');
  }

  try {
    const tokenPair = await authClient.login({ email, password, tenantSlug });
    const me = await authClient.me(tokenPair.accessToken);
    const cookieStore = await getCookieStore();

    await setSessionCookies(cookieStore, tokenPair, {
      id: me.tenant.id,
      slug: me.tenant.slug,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'No se pudo iniciar sesión';
    redirect(`/login?error=${encodeURIComponent(message)}`);
  }

  redirect('/app');
}

export async function logoutAction() {
  const cookieStore = await getCookieStore();
  const { refreshToken } = await getTokenSnapshot();

  try {
    if (refreshToken) {
      await authClient.logout({ refreshToken });
    }
  } catch {
    // noop; local cleanup still matters
  }

  await clearSessionCookies(cookieStore);
  redirect('/login');
}
