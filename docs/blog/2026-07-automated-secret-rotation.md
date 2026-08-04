# Automated secret rotation with a 24-hour grace window — done right in NestJS + Postgres

Most secret rotation stories go like this: at 3am on a Sunday, someone finally rotates the API key that's been the same since 2019. The rotation itself takes a minute. The outage lasts nine hours because six different callers had that secret pinned in config and their deploys hadn't run.

The fix isn't more discipline. The fix is making rotation boring: automatic, on a schedule, with a **grace window** during which both the old and the new secret work. Callers can migrate at their own pace, monitoring tells you who still holds the old one, and after 24 hours the old one dies quietly.

This is the pattern I built into `service_accounts` in a multi-tenant NestJS auth service. Post walks through the schema, the verify path (which is where most implementations get subtle bugs), the cron, and the four things I'd tell my past self before starting.

Full code: [ElwinErnst/auth-api](https://github.com/ElwinErnst/auth-api), specifically the `integrations/` module.

---

## The mental model

Each `service_account` has:

- A **current secret hash** — what new callers should use.
- A **previous secret hash + expires-at** — what old callers can still use, for a bounded window.
- Optionally, an **auto-rotation policy**: `rotationIntervalDays` (nullable) and a `nextRotationAt` timestamp.

Rotation itself is the same primitive whether it's triggered manually (an admin clicked "rotate") or by the cron (`nextRotationAt` reached). The only thing that changes is a `trigger: 'manual' | 'scheduled'` label in the log.

Every verify tries the current secret first. On failure, if `previousSecretExpiresAt` is still in the future, it tries the previous secret and logs a WARN so you can see who's still on the old credential. After the window expires, the previous hash becomes dead weight until the next rotation overwrites it.

That's the whole design. Everything else is code.

---

## Schema additions

Starting from an existing `service_accounts` table (with `secretHash`, `secretPreview`, `isActive`, `failedAuthAttempts`, etc.), we add four columns:

```typescript
@Column({ name: 'rotation_interval_days', type: 'int', nullable: true })
rotationIntervalDays!: number | null;

@Column({ name: 'next_rotation_at', type: 'timestamptz', nullable: true })
nextRotationAt!: Date | null;

@Column({ name: 'previous_secret_hash', type: 'text', nullable: true })
previousSecretHash!: string | null;

@Column({ name: 'previous_secret_expires_at', type: 'timestamptz', nullable: true })
previousSecretExpiresAt!: Date | null;
```

Two notes:

- **`rotationIntervalDays` is nullable.** `null` = manual only. The most common state for a fresh service account: someone provisions it, we haven't decided on an auto policy yet. Nullable is cleaner than "0 means off," which is a footgun waiting to happen when someone types 0 meaning "immediately."
- **`previous_secret_expires_at` is stored separately** rather than derived from `updated_at + grace`. Explicit is better here — the grace window might change in the future, and you don't want a config change to accidentally extend or shrink the acceptance window for previously-rotated secrets.

---

## Rotation (shared for manual and scheduled)

```typescript
private async rotateInternal(
  account: ServiceAccount,
  trigger: 'manual' | 'scheduled',
) {
  const previousHash = account.secretHash;

  const plainSecret = this.generateSecret();
  account.secretHash = await this.hashSecret(plainSecret);
  account.secretPreview = `••••${plainSecret.slice(-6)}`;
  account.lastUsedAt = null;

  // Keep the previous secret valid for GRACE_WINDOW_HOURS so callers
  // that still hold it have time to migrate without an outage.
  account.previousSecretHash = previousHash;
  account.previousSecretExpiresAt = new Date(
    Date.now() + GRACE_WINDOW_HOURS * 3600 * 1000,
  );

  // Reschedule next rotation if an auto policy is in place.
  if (account.rotationIntervalDays !== null) {
    account.nextRotationAt = new Date(
      Date.now() + account.rotationIntervalDays * 86400 * 1000,
    );
  }

  const saved = await this.serviceAccountsRepository.save(account);

  this.logger.log(
    `rotated service_account=${account.id} trigger=${trigger} grace_hours=${GRACE_WINDOW_HOURS}`,
  );

  return {
    serviceAccount: this.toServiceAccount(saved),
    clientSecret: plainSecret,
  };
}
```

The public surface is thin:

```typescript
async rotateServiceAccountSecret(tenantId: string, serviceAccountId: string) {
  await this.assertAuthApiEnabled(tenantId);
  const account = await this.findServiceAccount(tenantId, serviceAccountId);
  return this.rotateInternal(account, 'manual');
}

async autoRotateDue(): Promise<{ rotated: number }> {
  const now = new Date();
  const due = await this.serviceAccountsRepository.find({
    where: {
      rotationIntervalDays: Not(null as unknown as number),
      nextRotationAt: LessThanOrEqual(now),
      isActive: true,
    },
    take: 100,
  });

  let rotated = 0;
  for (const account of due) {
    try {
      await this.rotateInternal(account, 'scheduled');
      rotated += 1;
    } catch (err) {
      this.logger.error(
        `auto-rotate failed for service_account=${account.id}: ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
    }
  }
  return { rotated };
}
```

`autoRotateDue` intentionally logs and swallows per-account failures. If one account's rotation fails (a stale reference, a stray unique-index violation, whatever), the batch keeps going. The alternative — abort the whole batch on the first error — means one broken account blocks every other account's scheduled rotation.

---

## The verify path (this is where it usually goes wrong)

Most implementations of "grace window" get *this* wrong. They either check the previous secret *before* the current (which lets the old secret keep working forever if you never cleared it), or they check both without distinguishing which one won (which loses the "who's still on the old credential" signal).

Here's the version that keeps both properties:

```typescript
const secretOk = await this.verifySecret(dto.clientSecret, account.secretHash);
let usedPreviousSecret = false;

if (!secretOk) {
  // Grace window: accept the previous secret if it hasn't expired yet.
  const previousStillValid =
    account.previousSecretHash &&
    account.previousSecretExpiresAt &&
    account.previousSecretExpiresAt.getTime() > Date.now();

  if (previousStillValid) {
    const prevOk = await this.verifySecret(
      dto.clientSecret,
      account.previousSecretHash!,
    );
    if (prevOk) {
      usedPreviousSecret = true;
      this.logger.warn(
        `service_account=${account.id} authenticated with previous secret; grace_expires_at=${account.previousSecretExpiresAt!.toISOString()}`,
      );
    }
  }

  if (!usedPreviousSecret) {
    await this.registerTokenFailure(account);
    throw new UnauthorizedException('Invalid service account credentials');
  }
}
```

Properties this preserves:

- **Current secret is always tried first.** Fast path for the majority of callers.
- **Previous is only attempted if current failed.** No wasted crypto on the happy path.
- **Previous validity is time-bounded.** After `previousSecretExpiresAt`, the check is skipped without even hashing.
- **Successful use of the previous secret emits a WARN log** with the account ID and expiry. Ship that into your alerting and you know exactly which callers are behind.
- **Failure counters and lockouts still apply** on total failure, not on falling back to previous. A caller using an old-but-still-valid secret is not a suspicious event; they've just been slow to redeploy.

The `usedPreviousSecret` flag is currently just for the log. In a future iteration you'd want to also expose it in the response (so a caller's SDK can auto-refresh its cached secret), but that's a separate design conversation.

---

## The scheduler

`@nestjs/schedule` does the plumbing:

```typescript
@Injectable()
export class SecretRotationCron {
  private readonly logger = new Logger(SecretRotationCron.name);

  constructor(private readonly integrations: IntegrationsService) {}

  @Cron(CronExpression.EVERY_10_MINUTES)
  async tick(): Promise<void> {
    try {
      const { rotated } = await this.integrations.autoRotateDue();
      if (rotated > 0) {
        this.logger.log(`tick rotated=${rotated}`);
      }
    } catch (err) {
      this.logger.error(
        `tick failed: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }
}
```

Ten-minute interval is a deliberate call. Every 10 minutes gives you a maximum drift of 10 minutes between the scheduled `nextRotationAt` and the actual rotation. For a 30-day rotation cadence that's a 0.02% drift, which nobody cares about. For a 1-day (dev/testing) cadence it's 0.7%, still fine. If you drop the cadence to hourly rotation you'd want to tighten this.

The cron is idempotent. If a rotation runs and advances `nextRotationAt`, the next tick's `WHERE nextRotationAt <= now()` filter skips it. If you have two nodes running the cron (you shouldn't, but suppose), the second one will see the accounts as already-rotated and no-op. Postgres row-level locking on the save handles the concurrent-rotate race — you'd get two attempts for the same account, but the loser's write just overwrites with a slightly newer secret and the caller sees a valid credential.

---

## Setting the policy

The policy is a per-account attribute, editable by tenant owners/admins:

```typescript
@Patch('tenants/:tenantId/service-accounts/:serviceAccountId/rotation-policy')
@UseGuards(AccessJwtGuard, RolesGuard, TenantScopeGuard)
@Roles('OWNER', 'ADMIN')
setRotationPolicy(
  @Param('tenantId') tenantId: string,
  @Param('serviceAccountId') serviceAccountId: string,
  @Body() dto: SetRotationPolicyDto,
) {
  return this.integrationsService.setRotationPolicy(
    tenantId,
    serviceAccountId,
    dto.rotationIntervalDays ?? null,
  );
}
```

The DTO enforces sanity:

```typescript
export class SetRotationPolicyDto {
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(365)
  rotationIntervalDays?: number | null;
}
```

Bounds are `[1, 365]`. Below 1 day: you're probably testing (and you can pass a value like 1 and manually delete `next_rotation_at` if you really need to test now). Above 365 days: at that point the rotation is nominal and you should probably not have "automatic" in the name.

When the policy changes, `nextRotationAt` is recomputed from *now*, not from the previous `nextRotationAt`. Setting a 30-day policy at 3pm on a Tuesday sets the next rotation for the same time 30 days later, regardless of what the previous schedule looked like.

---

## What this doesn't cover (on purpose)

- **Notification to callers before rotation.** You could email the tenant owner "rotation scheduled in 24h" — that's product surface, not infrastructure. Add it once you have a notification pipeline.
- **Automatic secret migration for known integrations.** If your callers are all your own Kubernetes deployments, you could patch their secret manager on rotate. That's a big scope creep for a general auth service — leave it to whoever runs the caller.
- **Rotation of the JWT signing keys themselves.** Different problem, different solution (key rollover with issuer-verified `kid` in the JWT header). Deferred; the service-account secret rotation covers 80% of the pain.
- **Metrics dashboards.** The WARN log is the audit trail; sticking Prometheus counters on `usedPreviousSecret` events is a natural next step once the observability stack is in place.

---

## Tradeoffs vs. other approaches

**Manual-only rotation, no automation.** What most SaaS auth systems do out of the box. Works if your users are disciplined; catastrophic when a secret leaks and needs immediate cycling but nobody remembers the rotation runbook.

**Immediate rotation, no grace window.** Simple. Every rotation is an outage until every caller updates its config. For a service account used by five backend services, that's five deploys before the world comes back. Not viable in practice.

**HashiCorp Vault dynamic credentials.** Real answer for production. Each caller gets a short-lived credential auto-generated on request; nothing to rotate because nothing lives long enough to become stale. Requires committing to Vault as infrastructure — big lift, big win at scale.

**AWS Secrets Manager rotation.** Similar pattern to what's here (schedule + Lambda hook), scoped to AWS. Fine if you're all-in on AWS. Not portable.

**The "grace window in the app" approach here.** Simple, portable, no new infrastructure. Doesn't scale to *many* callers per credential the way dynamic credentials do, but scales fine to the "service-to-service integrations for a SaaS" use case, and any team can operate it without a new runbook.

---

## The four things worth flagging

- **`nullable = manual-only`** for the interval, not `0 = off`. Zero is a footgun.
- **Grace window as an explicit timestamp**, not computed from `updated_at`. Configurable grace period can change without invalidating past rotations.
- **Try current first, previous second.** Never the other way around; you lose the observability signal if the old one just keeps working silently.
- **Cron is idempotent by design.** Query filter on `nextRotationAt <= now()` + advance-on-rotate means running the same rotation twice is a no-op.

---

## Source

- Service (rotate + verify + policy): [`src/modules/integrations/integrations.service.ts`](https://github.com/ElwinErnst/auth-api/blob/main/src/modules/integrations/integrations.service.ts)
- Cron: [`src/modules/integrations/secret-rotation.cron.ts`](https://github.com/ElwinErnst/auth-api/blob/main/src/modules/integrations/secret-rotation.cron.ts)
- Entity: [`src/modules/integrations/entities/service-account.entity.ts`](https://github.com/ElwinErnst/auth-api/blob/main/src/modules/integrations/entities/service-account.entity.ts)
- Endpoint: `PATCH /tenants/:tenantId/service-accounts/:serviceAccountId/rotation-policy`
- Meta-repo: [ElwinErnst/sytadel-suite](https://github.com/ElwinErnst/sytadel-suite)

If you build something similar or spot a bug in the grace-window logic, drop it in the [repo issues](https://github.com/ElwinErnst/sytadel-suite/issues).
