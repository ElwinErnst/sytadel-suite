import type {
  AuthenticationResponseJSON,
  PublicKeyCredentialCreationOptionsJSON,
  PublicKeyCredentialRequestOptionsJSON,
  RegistrationResponseJSON,
} from '@simplewebauthn/browser';
import { env } from './env';
import { requestJson } from './http';
import type { TokenPair } from './types';

export type PasskeySummary = {
  id: string;
  friendlyName: string;
  deviceType: 'singleDevice' | 'multiDevice';
  backedUp: boolean;
  transports: string[];
  createdAt: string;
  lastUsedAt: string | null;
};

export async function registrationBegin(accessToken: string) {
  return requestJson<PublicKeyCredentialCreationOptionsJSON>(
    `${env.authApiUrl}/passkeys/registration/begin`,
    { method: 'POST', token: accessToken },
  );
}

export async function registrationFinish(
  accessToken: string,
  response: RegistrationResponseJSON,
  friendlyName: string,
) {
  return requestJson<PasskeySummary>(
    `${env.authApiUrl}/passkeys/registration/finish`,
    { method: 'POST', token: accessToken, body: { response, friendlyName } },
  );
}

export async function authenticationBegin(email: string, tenantSlug: string) {
  return requestJson<PublicKeyCredentialRequestOptionsJSON>(
    `${env.authApiUrl}/passkeys/authentication/begin`,
    { method: 'POST', body: { email, tenantSlug } },
  );
}

export async function authenticationFinish(
  response: AuthenticationResponseJSON,
  tenantSlug: string,
) {
  return requestJson<TokenPair>(
    `${env.authApiUrl}/passkeys/authentication/finish`,
    { method: 'POST', body: { response, tenantSlug } },
  );
}

export async function list(accessToken: string) {
  return requestJson<PasskeySummary[]>(`${env.authApiUrl}/passkeys`, {
    method: 'GET',
    token: accessToken,
  });
}

export async function rename(
  accessToken: string,
  id: string,
  friendlyName: string,
) {
  return requestJson<PasskeySummary>(`${env.authApiUrl}/passkeys/${id}`, {
    method: 'PATCH',
    token: accessToken,
    body: { friendlyName },
  });
}

export async function remove(accessToken: string, id: string) {
  return requestJson<void>(`${env.authApiUrl}/passkeys/${id}`, {
    method: 'DELETE',
    token: accessToken,
  });
}
