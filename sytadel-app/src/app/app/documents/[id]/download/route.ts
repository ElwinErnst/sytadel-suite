import { NextResponse } from 'next/server';
import { getTokenSnapshot, refreshSessionOrThrow } from '@/lib/server/session';
import * as vaultClient from '@/lib/server/vault-client';

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const { accessToken } = await getTokenSnapshot();

  let token = accessToken;
  if (!token) {
    token = await refreshSessionOrThrow();
  }

  let response = await vaultClient.downloadDocument(token, id);

  if (response.status === 401) {
    token = await refreshSessionOrThrow();
    response = await vaultClient.downloadDocument(token, id);
  }

  if (!response.ok || !response.body) {
    return NextResponse.json(
      { message: 'No se pudo descargar el documento.' },
      { status: response.status || 500 },
    );
  }

  const headers = new Headers();
  const contentType = response.headers.get('content-type');
  const disposition = response.headers.get('content-disposition');

  if (contentType) headers.set('content-type', contentType);
  if (disposition) headers.set('content-disposition', disposition);

  return new NextResponse(response.body, {
    status: response.status,
    headers,
  });
}
