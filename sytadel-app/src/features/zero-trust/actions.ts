'use server';

import { revalidatePath } from 'next/cache';
import { ApiError } from '@/lib/server/http';
import { requireSession, withSessionToken } from '@/lib/server/session';
import * as ztPolicyClient from '@/lib/server/zt-policy-client';
import type { PolicySet } from '@/lib/server/types/policy.type';

export type PublishPolicyResult =
  | { ok: true; version: number }
  | { ok: false; error: string };

/**
 * Publish a Zero Trust policy set for the current tenant. Only OWNER/ADMIN may
 * publish — the auth-api route enforces the same, this is the first line of
 * defense so the console never shows a confusing 403 from the editor. auth-api
 * validates the policy shape and returns a 400 with a message on invalid input.
 */
export async function publishPolicyAction(
  policySet: PolicySet,
): Promise<PublishPolicyResult> {
  const session = await requireSession();

  const canPublish =
    session.roles.includes('OWNER') || session.roles.includes('ADMIN');
  if (!canPublish) {
    return {
      ok: false,
      error: 'Solo una cuenta OWNER o ADMIN puede publicar políticas.',
    };
  }

  try {
    const published = await withSessionToken((token) =>
      ztPolicyClient.publishPolicy(token, session.tenant.id, policySet),
    );
    revalidatePath('/app/zero-trust');
    return { ok: true, version: published.version };
  } catch (error) {
    const message =
      error instanceof ApiError
        ? error.message
        : error instanceof Error
          ? error.message
          : 'No se pudo publicar la política.';
    return { ok: false, error: message };
  }
}
