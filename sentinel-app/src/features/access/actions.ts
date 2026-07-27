'use server';

import { revalidatePath } from 'next/cache';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import * as authClient from '@/lib/server/auth-client';
import { withSessionToken } from '@/lib/server/session';

const INTEGRATION_SECRET_COOKIE = 'sytadel_integration_secret';

function parseBoolean(value: FormDataEntryValue | null) {
  return value === 'true' || value === 'on';
}

export async function createMembershipAction(formData: FormData) {
  const userId = String(formData.get('userId') ?? '').trim();
  const tenantId = String(formData.get('tenantId') ?? '').trim();
  const role = String(formData.get('role') ?? 'MEMBER') as 'OWNER' | 'ADMIN' | 'MEMBER';

  if (!userId || !tenantId) {
    throw new Error('Faltan userId o tenantId.');
  }

  try {
    await withSessionToken((token) =>
      authClient.createMembership(token, { userId, tenantId, role }),
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : 'No se pudo crear la membership.';
    redirect(`/app/access?error=${encodeURIComponent(message)}`);
  }

  revalidatePath('/app/access');
  redirect('/app/access?message=Membership%20creada');
}

export async function createUserAndMembershipAction(formData: FormData) {
  const email = String(formData.get('email') ?? '').trim().toLowerCase();
  const password = String(formData.get('password') ?? '').trim();
  const firstName = String(formData.get('firstName') ?? '').trim();
  const lastName = String(formData.get('lastName') ?? '').trim();
  const tenantId = String(formData.get('tenantId') ?? '').trim();
  const role = String(formData.get('role') ?? 'MEMBER') as 'OWNER' | 'ADMIN' | 'MEMBER';

  if (!email || !password || !tenantId) {
    throw new Error('Faltan email, password o tenantId.');
  }

  try {
    await withSessionToken(async (token) => {
      const user = await authClient.createUser(token, {
        email,
        password,
        firstName: firstName || undefined,
        lastName: lastName || undefined,
      });

      await authClient.createMembership(token, {
        userId: user.id,
        tenantId,
        role,
      });
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'No se pudo crear el usuario.';
    redirect(`/app/access?error=${encodeURIComponent(message)}`);
  }

  revalidatePath('/app');
  revalidatePath('/app/access');
  redirect('/app/access?message=Usuario%20y%20membership%20creados');
}

export async function createTenantAction(formData: FormData) {
  const name = String(formData.get('name') ?? '').trim();
  const slug = String(formData.get('slug') ?? '').trim();

  if (!name || !slug) {
    throw new Error('Faltan nombre o slug del tenant.');
  }

  try {
    await withSessionToken((token) =>
      authClient.createTenant(token, {
        name,
        slug,
        planCode: 'FREE',
        vaultsEnabled: true,
        ztPoliciesEnabled: false,
      }),
    );
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'No se pudo crear el tenant.';
    redirect(`/app?error=${encodeURIComponent(message)}`);
  }

  revalidatePath('/app');
  revalidatePath('/app/access');
  revalidatePath('/app/vaults');
  revalidatePath('/app/documents');
  redirect('/app?message=Tenant%20creado.%20Ingres%C3%A1%20con%20el%20nuevo%20slug%20para%20usarlo');
}

export async function updateMembershipAction(formData: FormData) {
  const membershipId = String(formData.get('membershipId') ?? '').trim();
  const role = String(formData.get('role') ?? '').trim() as
    | 'OWNER'
    | 'ADMIN'
    | 'MEMBER';
  const isActive = parseBoolean(formData.get('isActive'));

  if (!membershipId) {
    throw new Error('Falta membershipId.');
  }

  try {
    await withSessionToken((token) =>
      authClient.updateMembership(token, membershipId, { role, isActive }),
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : 'No se pudo actualizar la membership.';
    redirect(`/app/access?error=${encodeURIComponent(message)}`);
  }

  revalidatePath('/app/access');
  redirect('/app/access?message=Membership%20actualizada');
}

export async function createClientAppAction(formData: FormData) {
  const tenantId = String(formData.get('tenantId') ?? '').trim();
  const name = String(formData.get('name') ?? '').trim();
  const slug = String(formData.get('slug') ?? '').trim();
  const description = String(formData.get('description') ?? '').trim();

  if (!tenantId || !name || !slug) {
    throw new Error('Faltan tenantId, nombre o slug.');
  }

  try {
    await withSessionToken((token) =>
      authClient.createClientApp(token, tenantId, {
        name,
        slug,
        description: description || undefined,
      }),
    );
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'No se pudo crear la client app.';
    redirect(`/app/access?error=${encodeURIComponent(message)}`);
  }

  revalidatePath('/app/access');
  redirect('/app/access?message=Client%20app%20creada');
}

export async function updateClientAppAction(formData: FormData) {
  const tenantId = String(formData.get('tenantId') ?? '').trim();
  const clientAppId = String(formData.get('clientAppId') ?? '').trim();
  const name = String(formData.get('name') ?? '').trim();
  const slug = String(formData.get('slug') ?? '').trim();
  const description = String(formData.get('description') ?? '').trim();
  const nextState = String(formData.get('nextState') ?? '').trim();

  if (!tenantId || !clientAppId || !name || !slug) {
    throw new Error('Faltan tenantId, clientAppId, nombre o slug.');
  }

  try {
    await withSessionToken((token) =>
      authClient.updateClientApp(token, tenantId, clientAppId, {
        name,
        slug,
        description: description || undefined,
        isActive:
          nextState === 'activate' ? true : nextState === 'deactivate' ? false : undefined,
      }),
    );
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'No se pudo actualizar la Client App.';
    redirect(`/app/access?error=${encodeURIComponent(message)}`);
  }

  revalidatePath('/app/access');
  redirect(
    `/app/access?message=${encodeURIComponent(
      nextState === 'activate'
        ? 'Client App reactivada'
        : nextState === 'deactivate'
          ? 'Client App desactivada'
          : 'Client App actualizada',
    )}`,
  );
}

export async function createServiceAccountAction(formData: FormData) {
  const tenantId = String(formData.get('tenantId') ?? '').trim();
  const clientAppId = String(formData.get('clientAppId') ?? '').trim();
  const name = String(formData.get('name') ?? '').trim();
  const description = String(formData.get('description') ?? '').trim();

  if (!tenantId || !clientAppId || !name) {
    throw new Error('Faltan tenantId, clientAppId o nombre.');
  }

  try {
    const created = await withSessionToken((token) =>
      authClient.createServiceAccount(token, tenantId, clientAppId, {
        name,
        description: description || undefined,
      }),
    );

    const store = await cookies();
    store.set(
      INTEGRATION_SECRET_COOKIE,
      JSON.stringify({
        clientAppId,
        name: created.serviceAccount.name,
        secret: created.clientSecret,
      }),
      {
        httpOnly: true,
        sameSite: 'lax',
        secure: process.env.NODE_ENV === 'production',
        path: '/app/access',
        maxAge: 120,
      },
    );
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : 'No se pudo crear la service account.';
    redirect(`/app/access?error=${encodeURIComponent(message)}`);
  }

  revalidatePath('/app/access');
  redirect(
    '/app/access?message=Service%20account%20creada.%20Guard%C3%A1%20el%20secret%20ahora%20porque%20no%20se%20volver%C3%A1%20a%20mostrar.',
  );
}

export async function rotateServiceAccountSecretAction(formData: FormData) {
  const tenantId = String(formData.get('tenantId') ?? '').trim();
  const serviceAccountId = String(formData.get('serviceAccountId') ?? '').trim();

  if (!tenantId || !serviceAccountId) {
    throw new Error('Faltan tenantId o serviceAccountId.');
  }

  try {
    const created = await withSessionToken((token) =>
      authClient.rotateServiceAccountSecret(token, tenantId, serviceAccountId),
    );

    const store = await cookies();
    store.set(
      INTEGRATION_SECRET_COOKIE,
      JSON.stringify({
        clientAppId: created.serviceAccount.clientAppId,
        name: created.serviceAccount.name,
        secret: created.clientSecret,
      }),
      {
        httpOnly: true,
        sameSite: 'lax',
        secure: process.env.NODE_ENV === 'production',
        path: '/app/access',
        maxAge: 120,
      },
    );
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : 'No se pudo rotar el secreto de la service account.';
    redirect(`/app/access?error=${encodeURIComponent(message)}`);
  }

  revalidatePath('/app/access');
  redirect(
    '/app/access?message=Secret%20rotado.%20Guard%C3%A1%20el%20nuevo%20valor%20ahora%20porque%20no%20se%20volver%C3%A1%20a%20mostrar.',
  );
}

export async function toggleServiceAccountAction(formData: FormData) {
  const tenantId = String(formData.get('tenantId') ?? '').trim();
  const serviceAccountId = String(formData.get('serviceAccountId') ?? '').trim();
  const nextState = String(formData.get('nextState') ?? '').trim();

  if (!tenantId || !serviceAccountId || !nextState) {
    throw new Error('Faltan tenantId, serviceAccountId o nextState.');
  }

  try {
    await withSessionToken((token) =>
      authClient.updateServiceAccount(token, tenantId, serviceAccountId, {
        isActive: nextState === 'activate',
      }),
    );
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : 'No se pudo actualizar la service account.';
    redirect(`/app/access?error=${encodeURIComponent(message)}`);
  }

  revalidatePath('/app/access');
  redirect(
    `/app/access?message=${encodeURIComponent(
      nextState === 'activate'
        ? 'Service account reactivada'
        : 'Service account desactivada',
    )}`,
  );
}
