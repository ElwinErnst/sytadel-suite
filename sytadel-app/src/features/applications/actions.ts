'use server';

import { redirect } from 'next/navigation';
import { createApplication } from '@/lib/server/applications-client';
import { ApiError } from '@/lib/server/http';
import { requireSession, withSessionToken } from '@/lib/server/session';

function fail(message: string): never {
  redirect(`/app/applications?error=${encodeURIComponent(message)}`);
}

export async function createApplicationAction(formData: FormData) {
  const session = await requireSession();
  if (!session.roles.includes('OWNER') && !session.roles.includes('ADMIN')) {
    fail('Solo OWNER o ADMIN puede crear aplicaciones.');
  }

  const name = String(formData.get('name') ?? '').trim();
  const slug = String(formData.get('slug') ?? '').trim();
  const description = String(formData.get('description') ?? '').trim() || undefined;

  if (!name || !slug) {
    fail('Nombre y slug son requeridos.');
  }
  if (!/^[a-z0-9-]+$/.test(slug)) {
    fail('El slug solo admite minúsculas, números y guiones.');
  }

  try {
    await withSessionToken((token, cookieStore) =>
      createApplication(
        token,
        cookieStore.get('sentinel_tenant_id')?.value ?? '',
        { name, slug, description },
      ),
    );
  } catch (error) {
    fail(
      error instanceof ApiError
        ? error.message
        : 'No se pudo crear la aplicación.',
    );
  }

  redirect(`/app/applications?created=${encodeURIComponent(slug)}`);
}
