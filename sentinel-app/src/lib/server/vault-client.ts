import { env } from './env';
import { requestJson } from './http';
import type {
  AuditSearchQuery,
  AuditSearchResult,
  DocumentRecord,
  VaultRecord,
  VerifyDocumentResult,
} from './types';

export async function listVaults(accessToken: string) {
  return requestJson<VaultRecord[]>(`${env.ztApiUrl}/vault/vaults`, {
    method: 'GET',
    token: accessToken,
  });
}

export async function createVault(
  accessToken: string,
  input: { name: string; slug?: string },
) {
  return requestJson<VaultRecord>(`${env.ztApiUrl}/vault/vaults`, {
    method: 'POST',
    token: accessToken,
    body: input,
  });
}

export async function deleteVault(accessToken: string, id: string) {
  return requestJson<{ ok: true }>(`${env.ztApiUrl}/vault/vaults/${id}`, {
    method: 'DELETE',
    token: accessToken,
  });
}

export async function listDocuments(accessToken: string, vaultId: string) {
  const params = new URLSearchParams({ vaultId });
  return requestJson<DocumentRecord[]>(
    `${env.ztApiUrl}/vault/documents?${params.toString()}`,
    {
      method: 'GET',
      token: accessToken,
    },
  );
}

export async function uploadDocument(
  accessToken: string,
  input: {
    vaultId: string;
    name?: string;
    fileName: string;
    mimeType: string;
    buffer: Buffer;
  },
) {
  const form = new FormData();
  const blob = new Blob([new Uint8Array(input.buffer)], { type: input.mimeType });
  form.append('file', blob, input.fileName);

  const params = new URLSearchParams({ vaultId: input.vaultId });
  if (input.name) params.set('name', input.name);

  return requestJson<DocumentRecord>(
    `${env.ztApiUrl}/vault/documents?${params.toString()}`,
    {
      method: 'POST',
      token: accessToken,
      body: form,
    },
  );
}

export async function deleteDocument(accessToken: string, id: string) {
  return requestJson<{ ok: true }>(`${env.ztApiUrl}/vault/documents/${id}`, {
    method: 'DELETE',
    token: accessToken,
  });
}

export async function downloadDocument(accessToken: string, id: string) {
  const response = await fetch(`${env.ztApiUrl}/vault/documents/${id}/download`, {
    method: 'GET',
    headers: {
      authorization: `Bearer ${accessToken}`,
    },
    cache: 'no-store',
  });

  return response;
}

export async function listAuditLogs(
  accessToken: string,
  query: AuditSearchQuery = {},
) {
  const params = new URLSearchParams();

  for (const [key, value] of Object.entries(query)) {
    if (value == null || value === '') continue;
    params.set(key, String(value));
  }

  const suffix = params.toString();

  return requestJson<AuditSearchResult>(
    `${env.ztApiUrl}/vault/audit-logs${suffix ? `?${suffix}` : ''}`,
    {
      method: 'GET',
      token: accessToken,
    },
  );
}

export async function verifyDocument(documentId: string) {
  const params = new URLSearchParams({ documentId });

  return requestJson<VerifyDocumentResult>(
    `${env.vaultApiUrl}/public/verify?${params.toString()}`,
    {
      method: 'GET',
    },
  );
}
