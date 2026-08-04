'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import * as authClient from '@/lib/server/auth-client';
import {
  clearSessionCookies,
  getCookieStore,
  requireSession,
  withSessionToken,
} from '@/lib/server/session';

function parseBoolean(value: FormDataEntryValue | null) {
  return value === 'true' || value === 'on';
}

function readOptionalString(formData: FormData, key: string) {
  const value = String(formData.get(key) ?? '').trim();
  return value ? value : undefined;
}

export async function updateProfileAction(formData: FormData) {
  const session = await requireSession();
  const firstName = readOptionalString(formData, 'firstName');
  const lastName = readOptionalString(formData, 'lastName');

  try {
    await withSessionToken((token) =>
      authClient.updateUser(token, session.user.id, {
        firstName,
        lastName,
      }),
    );
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'No se pudo actualizar el perfil.';
    redirect(`/app/settings?error=${encodeURIComponent(message)}`);
  }

  revalidatePath('/app');
  revalidatePath('/app/settings');
  redirect('/app/settings?message=Perfil%20actualizado');
}

export async function updateTenantSettingsAction(formData: FormData) {
  const session = await requireSession();

  if (!session.roles.includes('OWNER')) {
    redirect('/app/settings?error=Solo%20OWNER%20puede%20editar%20el%20tenant');
  }

  const name = readOptionalString(formData, 'name');
  const slug = readOptionalString(formData, 'slug');
  const isActive = parseBoolean(formData.get('isActive'));
  const billingBypass = parseBoolean(formData.get('billingBypass'));

  try {
    await withSessionToken((token) =>
      authClient.updateTenant(token, session.tenant.id, {
        name,
        slug,
        isActive,
        billingBypass,
      }),
    );
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'No se pudo actualizar el tenant.';
    redirect(`/app/settings?error=${encodeURIComponent(message)}`);
  }

  revalidatePath('/app');
  revalidatePath('/app/settings');
  revalidatePath('/app/vaults');
  revalidatePath('/app/documents');
  redirect('/app/settings?message=Tenant%20actualizado');
}

export async function logoutAllSessionsAction() {
  const cookieStore = await getCookieStore();

  try {
    await withSessionToken((token) => authClient.logoutAll(token));
  } catch {
    // local cookie cleanup still matters if backend logout-all fails
  }

  await clearSessionCookies(cookieStore);
  redirect('/login?message=Se%20cerraron%20todas%20las%20sesiones');
}
