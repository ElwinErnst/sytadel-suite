import type { RequestOptions } from './types/request-options.type';

export class ApiError extends Error {
  status: number;
  payload?: unknown;

  constructor(message: string, status: number, payload?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.payload = payload;
  }
}

function isBodyInit(value: unknown): value is BodyInit {
  return (
    typeof value === 'string' ||
    value instanceof URLSearchParams ||
    value instanceof FormData ||
    value instanceof Blob ||
    value instanceof ArrayBuffer
  );
}

export async function requestJson<T>(
  url: string,
  options: RequestOptions = {},
): Promise<T> {
  const headers = new Headers(options.headers);

  if (options.token) {
    headers.set('authorization', `Bearer ${options.token}`);
  }

  let body: BodyInit | undefined;

  if (options.body != null) {
    if (isBodyInit(options.body)) {
      body = options.body;
    } else {
      headers.set('content-type', 'application/json');
      body = JSON.stringify(options.body);
    }
  }

  let response: Response;

  try {
    response = await fetch(url, {
      ...options,
      headers,
      body,
      cache: 'no-store',
    });
  } catch (error) {
    throw new ApiError(readNetworkMessage(url, error), 503, {
      url,
      cause: error instanceof Error ? error.message : String(error),
    });
  }

  const text = await response.text();
  const data = text ? safeParse(text) : undefined;

  if (!response.ok) {
    throw new ApiError(readMessage(data, response.statusText), response.status, data);
  }

  return data as T;
}

function safeParse(text: string) {
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

function readMessage(data: unknown, fallback: string) {
  if (typeof data === 'string' && data) return data;
  if (data && typeof data === 'object' && 'message' in data) {
    const message = (data as { message?: unknown }).message;
    if (Array.isArray(message)) return message.join(', ');
    if (typeof message === 'string') return message;
  }
  return fallback || 'Request failed';
}

function readNetworkMessage(url: string, error: unknown) {
  const origin = safeOrigin(url);
  const message = error instanceof Error ? error.message : String(error);

  if (origin) {
    return `No se pudo conectar con ${origin}. Verificá que el servicio esté levantado.`;
  }

  return `No se pudo completar la request. ${message}`;
}

function safeOrigin(url: string) {
  try {
    return new URL(url).origin;
  } catch {
    return null;
  }
}
