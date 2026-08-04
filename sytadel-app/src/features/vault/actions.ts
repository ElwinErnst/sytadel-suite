'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import * as vaultClient from '@/lib/server/vault-client';
import { withSessionToken } from '@/lib/server/session';

export async function createVaultAction(formData: FormData) {
  const name = String(formData.get('name') ?? '').trim();
  const slug = String(formData.get('slug') ?? '').trim();

  if (!name) {
    throw new Error('El nombre del vault es obligatorio.');
  }

  try {
    await withSessionToken((token) =>
      vaultClient.createVault(token, { name, slug: slug || undefined }),
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : 'No se pudo crear el vault.';
    redirect(`/app/vaults?error=${encodeURIComponent(message)}`);
  }

  revalidatePath('/app');
  revalidatePath('/app/vaults');
  revalidatePath('/app/documents');
  redirect('/app/vaults?message=Vault%20creado');
}

export async function deleteVaultAction(formData: FormData) {
  const id = String(formData.get('vaultId') ?? '').trim();
  if (!id) throw new Error('Falta vaultId.');

  try {
    await withSessionToken((token) => vaultClient.deleteVault(token, id));
  } catch (error) {
    const message = error instanceof Error ? error.message : 'No se pudo eliminar el vault.';
    redirect(`/app/vaults?error=${encodeURIComponent(message)}`);
  }

  revalidatePath('/app');
  revalidatePath('/app/vaults');
  revalidatePath('/app/documents');
  redirect('/app/vaults?message=Vault%20eliminado');
}

export async function uploadDocumentAction(formData: FormData) {
  const vaultId = String(formData.get('vaultId') ?? '').trim();
  const name = String(formData.get('name') ?? '').trim();
  const file = formData.get('file');

  if (!vaultId || !(file instanceof File) || file.size === 0) {
    throw new Error('Faltan datos para subir el documento.');
  }

  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  try {
    await withSessionToken((token) =>
      vaultClient.uploadDocument(token, {
        vaultId,
        name: name || undefined,
        fileName: file.name,
        mimeType: file.type || 'application/octet-stream',
        buffer,
      }),
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : 'No se pudo subir el documento.';
    redirect(`/app/documents?vaultId=${encodeURIComponent(vaultId)}&error=${encodeURIComponent(message)}`);
  }

  revalidatePath('/app');
  revalidatePath('/app/documents');
  redirect(`/app/documents?vaultId=${encodeURIComponent(vaultId)}&message=Documento%20subido`);
}

export async function deleteDocumentAction(formData: FormData) {
  const id = String(formData.get('documentId') ?? '').trim();
  const vaultId = String(formData.get('vaultId') ?? '').trim();
  if (!id) throw new Error('Falta documentId.');

  try {
    await withSessionToken((token) => vaultClient.deleteDocument(token, id));
  } catch (error) {
    const message = error instanceof Error ? error.message : 'No se pudo eliminar el documento.';
    const suffix = vaultId ? `?vaultId=${encodeURIComponent(vaultId)}&error=${encodeURIComponent(message)}` : `?error=${encodeURIComponent(message)}`;
    redirect(`/app/documents${suffix}`);
  }

  revalidatePath('/app');
  revalidatePath('/app/documents');
  const suffix = vaultId ? `?vaultId=${encodeURIComponent(vaultId)}&message=Documento%20eliminado` : '?message=Documento%20eliminado';
  redirect(`/app/documents${suffix}`);
}
