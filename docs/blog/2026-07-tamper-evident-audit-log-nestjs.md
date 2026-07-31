# Building a tamper-evident audit log in NestJS with hash chains

Most audit logs are a lie by omission.

You write a row that says "user X deleted document Y at 12:03." A week later, an incident review pulls it up, everyone nods, case closed. What nobody checks is whether the row was still there yesterday, whether the timestamp was the original one, and whether *someone with database access* quietly edited it after the fact.

If your compliance story depends on that log being trustworthy — SOC 2, HIPAA, GDPR Article 30, or a customer's InfoSec review — you need more than "we insert rows and hope."

This post walks through a small, boring, effective pattern I use for that: a **hash-chained append-only audit log**, implemented in NestJS + Postgres, with per-tenant chains and a verification routine that fails loudly if anyone tampers.

Full code lives in [ElwinErnst/securechain-vault](https://github.com/ElwinErnst/securechain-vault) inside the [Sytadel Suite](https://github.com/ElwinErnst/sentinel-suite).

---

## The threat model

Assume an attacker who already has SQL access to the audit table. That's the person you're trying to catch — a rogue admin, a compromised backend, a poorly-scoped read-write DB user. If your logs can't survive them, they're theater.

Three concrete tamper actions to detect:

1. **Modify a row** — change the outcome from `FAILURE` to `SUCCESS`, rewrite the user ID, blank the metadata.
2. **Delete a row** — remove the trace of a specific action.
3. **Reorder or insert rows** — inject a fake event that "explains" a later observed state.

A regular audit table catches none of these. A hash chain catches all three.

---

## The design: hash chain

Every row stores three cryptographic hashes:

- **`eventHash`** — SHA-256 of the row's own payload (action, user, resource, HTTP context, metadata). If any field changes, this breaks.
- **`prevHash`** — the `chainHash` of the immediately previous event in the chain. This is what stitches events together.
- **`chainHash`** — SHA-256 of `prevHash + "|" + eventHash`. The cumulative fingerprint up to and including this event.

Plus a monotonic **`seq`** counter per chain and a **`scope`** (tenant ID or `GLOBAL`), so each tenant gets its own independent chain.

```
event 1: eventHash=H1, prevHash=null, chainHash=sha256("|" + H1) = C1
event 2: eventHash=H2, prevHash=C1,   chainHash=sha256(C1 + "|" + H2) = C2
event 3: eventHash=H3, prevHash=C2,   chainHash=sha256(C2 + "|" + H3) = C3
```

Tampering properties:

- **Modify** event 2 → `H2` changes → `C2` changes → event 3's `prevHash` no longer matches → chain breaks from event 3 onward.
- **Delete** event 2 → event 3's `prevHash` still points to `C2` that no longer exists as any row's `chainHash` → verification fails.
- **Insert** a fake event between 2 and 3 → `(scope, seq)` unique constraint blocks it, or if you renumber, both `prevHash` links break.
- **Reorder** → same as above.

The only way to rewrite one event silently is to rewrite every event after it — and you'd still leave the last `chainHash` different from what any external witness saw.

---

## The data model

```typescript
@Index(['scope', 'seq'], { unique: true })
@Index(['tenantId', 'createdAt'])
@Entity({ name: 'audit_logs' })
export class AuditLogEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid', name: 'tenant_id', nullable: true })
  tenantId!: string | null;

  @Column({ type: 'uuid', name: 'user_id', nullable: true })
  userId!: string | null;

  // scope = tenantId or 'GLOBAL' — per-tenant chains + one global chain
  @Column({ type: 'varchar', length: 64 })
  scope!: string;

  // Monotonic sequence within the scope
  @Column({ type: 'bigint' })
  seq!: string;

  @Column({ type: 'varchar', length: 80 })
  action!: string;

  @Column({ type: 'varchar', length: 60, name: 'resource_type' })
  resourceType!: string;

  @Column({ type: 'varchar', length: 120, name: 'resource_id', nullable: true })
  resourceId!: string | null;

  @Column({ type: 'varchar', length: 10 })
  outcome!: 'SUCCESS' | 'FAILURE';

  @Column({ type: 'int', name: 'http_status' })
  httpStatus!: number;

  @Column({ type: 'varchar', length: 10, name: 'http_method' })
  httpMethod!: string;

  @Column({ type: 'varchar', length: 255, name: 'http_path' })
  httpPath!: string;

  @Column({ type: 'inet', nullable: true })
  ip!: string | null;

  @Column({ type: 'varchar', length: 255, name: 'user_agent', nullable: true })
  userAgent!: string | null;

  @Column({ type: 'jsonb', nullable: true })
  metadata!: Record<string, unknown> | null;

  @Column({ type: 'char', length: 64, name: 'event_hash' })
  eventHash!: string;

  @Column({ type: 'char', length: 64, name: 'prev_hash', nullable: true })
  prevHash!: string | null;

  @Column({ type: 'char', length: 64, name: 'chain_hash' })
  chainHash!: string;

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt!: Date;
}
```

Two details that matter:

- **`(scope, seq)` is unique.** This is the constraint that blocks silent insertion of fake rows. Postgres will refuse a second row with `seq = 5` in the same scope.
- **`bigint` for `seq`, stored as string in TypeORM.** JavaScript's `Number` loses precision past 2^53. For long-lived audit tables you want the full 64-bit range.

---

## Deterministic serialization

Hashing arbitrary JavaScript objects is a trap: `JSON.stringify({a: 1, b: 2})` and `JSON.stringify({b: 2, a: 1})` produce different strings. The hash of your event would depend on how V8 happened to order the keys today, which is not a property you want to bet compliance on.

So the first primitive is a deterministic stringify that sorts keys recursively:

```typescript
function isPlainObject(value: unknown): value is Record<string, unknown> {
  return value != null && typeof value === 'object' && !Array.isArray(value);
}

export function stableStringify(input: unknown): string {
  if (Array.isArray(input)) {
    return `[${input.map(stableStringify).join(',')}]`;
  }
  if (isPlainObject(input)) {
    const keys = Object.keys(input).sort();
    const props = keys.map((key) => `"${key}":${stableStringify(input[key])}`);
    return `{${props.join(',')}}`;
  }
  return JSON.stringify(input);
}

export function sha256Hex(s: string): string {
  return createHash('sha256').update(s).digest('hex');
}
```

Twenty lines, no dependencies, does exactly one job.

---

## Writing an event: `createChained`

The write path has to do three things atomically: pick the next `seq`, read the previous `chainHash`, and insert the new row. If two requests race, they must not both grab `seq = 5`.

```typescript
async createChained(input: CreateAuditLogInput): Promise<AuditLogEntity> {
  const scope = input.tenantId ?? 'GLOBAL';

  return this.dataSource.transaction(async (manager) => {
    const r = manager.getRepository(AuditLogEntity);

    // Lock the last event of this scope for write.
    // This serializes writes within one scope but does NOT
    // serialize across scopes — each tenant has its own chain.
    const last = await r
      .createQueryBuilder('a')
      .setLock('pessimistic_write')
      .where('a.scope = :scope', { scope })
      .orderBy('a.seq', 'DESC')
      .limit(1)
      .getOne();

    const nextSeq = last ? (BigInt(last.seq) + 1n).toString() : '1';
    const prevHash = last?.chainHash ?? null;

    const eventPayload = {
      scope, seq: nextSeq,
      tenantId: input.tenantId, userId: input.userId,
      action: input.action,
      resourceType: input.resourceType, resourceId: input.resourceId,
      outcome: input.outcome, httpStatus: input.httpStatus,
      httpMethod: input.httpMethod, httpPath: input.httpPath,
      ip: input.ip, userAgent: input.userAgent,
      metadata: input.metadata,
    };

    const eventHash = sha256Hex(stableStringify(eventPayload));
    const chainHash = sha256Hex(`${prevHash ?? ''}|${eventHash}`);

    const row = r.create({
      ...input, scope, seq: nextSeq,
      prevHash, eventHash, chainHash,
    });

    return r.save(row);
  });
}
```

Two things worth calling out:

**The lock is per-scope, not global.** Because `scope = tenantId`, tenant A's writes never block tenant B's writes. This is the difference between "audit log scales with tenants" and "audit log is your bottleneck." A multi-tenant SaaS with N active tenants can write N chains in parallel.

**The `eventPayload` is a subset of the row.** We deliberately don't hash `id` (assigned by Postgres later) or `createdAt` (also assigned later). If you hash things the database owns, you can't precompute the hash before the insert. Keep the hashed payload to fields the application controls.

---

## Automatic cross-cutting logging

Writing `createChained` calls in every controller is how audit logs stop happening. NestJS interceptors solve this by wrapping every request that has an `@Audit(...)` decorator:

```typescript
@Injectable()
export class AuditInterceptor implements NestInterceptor {
  constructor(
    private readonly reflector: Reflector,
    private readonly audit: AuditService,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const req = context.switchToHttp().getRequest<RequestWithContext>();
    const res = context.switchToHttp().getResponse<Response>();

    const meta = this.reflector.get<AuditMeta>(AUDIT_META_KEY, context.getHandler());

    const base = {
      tenantId: req.tenantContext?.tenantId ?? null,
      userId: req.user?.id ?? null,
      action: meta?.action ?? `${req.method} ${req.path}`,
      resourceType: meta?.resourceType ?? 'http',
      resourceId: resolveResourceId(req, meta),
      httpMethod: req.method,
      httpPath: req.path,
      ip: resolveIp(req),
      userAgent: req.headers['user-agent'] ?? null,
    };

    return next.handle().pipe(
      mergeMap((data) =>
        from(this.audit.createChained({
          ...base,
          outcome: 'SUCCESS',
          httpStatus: res.statusCode,
          metadata: meta?.metadata ?? null,
        })).pipe(mergeMap(() => [data])),
      ),
      catchError((err) =>
        from(this.audit.createChained({
          ...base,
          outcome: 'FAILURE',
          httpStatus: err?.getStatus?.() ?? 500,
          metadata: { errorName: err?.name, errorMessage: err?.message },
        })).pipe(mergeMap(() => throwError(() => err))),
      ),
    );
  }
}
```

A controller opts in with:

```typescript
@Delete(':id')
@Audit({ action: 'document.delete', resourceType: 'document', resourceIdParam: 'id' })
async deleteDocument(@Param('id') id: string) { ... }
```

Success and failure both get logged, with HTTP status, error name, and error message on failure. No controller ever calls the audit service directly.

---

## Verification: reading the chain back

Writing is only half. The whole point is being able to say "yes, this log is still intact" and prove it. A verification routine walks the chain in order and re-computes everything:

```typescript
async verifyChain(scope: string): Promise<VerifyResult> {
  const events = await this.repo
    .createQueryBuilder('a')
    .where('a.scope = :scope', { scope })
    .orderBy('a.seq', 'ASC')
    .getMany();

  let prevHash: string | null = null;
  let expectedSeq = 1n;

  for (const e of events) {
    // 1. seq must be strictly monotonic starting at 1
    if (BigInt(e.seq) !== expectedSeq) {
      return { ok: false, brokenAt: e.seq, reason: 'seq gap or reorder' };
    }

    // 2. eventHash must match the recomputed hash of the payload
    const recomputed = sha256Hex(stableStringify({
      scope: e.scope, seq: e.seq,
      tenantId: e.tenantId, userId: e.userId,
      action: e.action,
      resourceType: e.resourceType, resourceId: e.resourceId,
      outcome: e.outcome, httpStatus: e.httpStatus,
      httpMethod: e.httpMethod, httpPath: e.httpPath,
      ip: e.ip, userAgent: e.userAgent,
      metadata: e.metadata,
    }));
    if (recomputed !== e.eventHash) {
      return { ok: false, brokenAt: e.seq, reason: 'row was modified' };
    }

    // 3. prevHash must match the previous row's chainHash
    if (e.prevHash !== prevHash) {
      return { ok: false, brokenAt: e.seq, reason: 'prevHash mismatch' };
    }

    // 4. chainHash must match sha256(prevHash + "|" + eventHash)
    const expectedChain = sha256Hex(`${prevHash ?? ''}|${e.eventHash}`);
    if (e.chainHash !== expectedChain) {
      return { ok: false, brokenAt: e.seq, reason: 'chainHash mismatch' };
    }

    prevHash = e.chainHash;
    expectedSeq++;
  }

  return { ok: true, verified: events.length, headChainHash: prevHash };
}
```

The `headChainHash` at the end is the single value you can print, sign, tweet, or ship to an external witness. If tomorrow anyone modifies a single field of any row, the recomputed `headChainHash` will be different from the one you published today.

---

## Benchmarks

Setup: NestJS 10 + Postgres 16 in Docker Compose, MacBook Pro M2. Single vault-api instance, single Postgres. Benchmark script calls `GET /vault/vaults` (an audited endpoint) via the Zero Trust gateway so each request round-trips through auth + gateway + vault + audit write.

**Sequential write, single scope (concurrency = 1, N = 1,000):**

| Metric | Value |
|--------|-------|
| Throughput | **205.8 writes/sec** |
| Latency p50 | **4.7 ms** |
| Latency p95 | **6.3 ms** |
| Latency p99 | **8.6 ms** |
| Latency max | 12.4 ms |

**Storage:**

| Metric | Value |
|--------|-------|
| Rows | 3,258 |
| Total table size (heap + indexes) | 3,728 kB |
| Heap size | 2,712 kB |
| Bytes per row (heap) | **~852 bytes** |

**Chain verification (N = 3,238 in one scope):**

| Phase | Time |
|-------|------|
| Fetch all rows from Postgres | 85–107 ms |
| Recompute + verify chain | 13–17 ms |
| **End-to-end verify** | **~100 ms** |

The verify step alone processes **~250k rows/sec** on a single thread — the bottleneck is fetching from Postgres, not the crypto. A 1M-row chain verifies in under 30 seconds on this hardware.

### The concurrent-write bug (and the fix)

The sequential numbers hide a subtle race. Running the same bench with `concurrency = 20` against a single scope surfaced it immediately: ~55% of requests failed with `duplicate key value violates unique constraint "audit_logs_scope_seq"` (Postgres error `23505`), and the vault returned HTTP 500.

Root cause: under `READ COMMITTED` isolation, two transactions can both read `seq = N` before either has inserted `seq = N+1`. The `SELECT ... FOR UPDATE LIMIT 1` locks the *existing row it found*, not the *nonexistent row about to be inserted*. Both transactions then try to insert `seq = N+1` and the unique constraint aborts the second one.

Three ways to fix it, in increasing order of correctness:

1. **App-side retry with backoff on `23505`.** Simple, works, but you're papering over the race instead of preventing it.
2. **`pg_advisory_xact_lock(hashtext(scope))` at the start of the transaction.** Serializes writes per-scope explicitly. Cheap, deterministic. The lock releases automatically at `COMMIT`.
3. **`SERIALIZABLE` transaction isolation.** Postgres aborts conflicting transactions cleanly and you retry. Most correct, slightly more overhead across the whole app.

**The fix I shipped** ([commit `556f7c3`](https://github.com/ElwinErnst/securechain-vault/commit/556f7c3)) uses the advisory lock. `hashtext(scope)` returns int32, which `pg_advisory_xact_lock` accepts, and the lock scopes to the transaction — no cleanup, no leaks.

Re-running the same `concurrency = 20` bench after the fix:

| | Before | After |
|---|--------|-------|
| Requests succeeded | 228 / 500 | **500 / 500** |
| 23505 errors | 272 | **0** |
| Throughput | 167 req/sec | **497 req/sec** |
| Latency p95 | 31 ms | 60 ms |

Sequential throughput is essentially unchanged (198 vs 205 req/sec, +1 ms p95 for the extra advisory-lock round-trip). Chain verification still passes end-to-end after the fix.

The p95 went up under concurrency because requests now *wait* for the lock instead of failing fast — that's the tradeoff you want. Serialized-and-slow beats fast-and-broken every time in an audit context.

For an audit log, per-scope serialization is not a scaling loss — it's the semantics you want anyway (one chain = one linear history). The original implementation just picked the wrong primitive to enforce it.

### Cross-scope scaling

Because `scope = tenantId`, different tenants never contend on the same lock. Multi-tenant throughput scales close to linearly with the number of active tenants until you hit Postgres write ceiling. A single-instance Postgres 16 on modest hardware sustains a few thousand writes/sec across many chains without breaking a sweat.

---

## Tamper detection, live

To prove the chain actually catches modifications, I ran a quick experiment against the same 3,238-row table:

```bash
# 1. Modify one row (seq=100 flipped from SUCCESS to FAILURE)
UPDATE audit_logs
   SET outcome = 'FAILURE'
 WHERE scope = 'f4a...' AND seq = 100;

# 2. Run verify
$ node verify-chain.mjs
Fetched 3238 rows in 85 ms

== VERIFY RESULT ==
rows verified  : 3238
ok             : false
broken at seq  : 100
reason         : eventHash mismatch (row modified)
head chainHash : caae1db44dcd4391...

# 3. Revert
UPDATE audit_logs
   SET outcome = 'SUCCESS'
 WHERE scope = 'f4a...' AND seq = 100;

# 4. Verify again
$ node verify-chain.mjs
rows verified  : 3238
ok             : true
head chainHash : 80f73959d1ba21bc...
```

Two things worth noting:

- The verify pinpoints the exact row where the chain broke, not just "something's wrong."
- After reverting, the `headChainHash` is the *same value it had before the tamper* (`80f73959d1ba21bc...`). If you published that hash yesterday to an external witness — a tweet, a Slack, a customer email — you can now prove today that the log is byte-identical to yesterday's.

---

## Tradeoffs vs. other approaches

**Merkle tree.** Verification is O(log N) instead of O(N), and you can prove that a specific event is or isn't in the tree without walking everything. Worth it if you need selective inclusion proofs (e.g. showing an auditor "here's your event, here's the proof it's in the log we published") without exposing the rest of the log. Extra machinery, more code paths to get wrong.

**Anchoring in a blockchain.** Publish periodic `chainHash` snapshots to Bitcoin (via OpenTimestamps) or Ethereum. You get an external, adversarial witness — nobody can rewrite Bitcoin to cover up a log tamper. Downside: cost, latency, and operational complexity. Good for milestone checkpoints (daily/weekly), overkill for every event.

**HSM-signed logs.** Sign each event with a hardware key. You get non-repudiation on top of integrity — you can prove *who* wrote the log, not just that it's intact. Requires HSM infrastructure, adds latency to every write.

**Just a hash chain in Postgres, like this post.** Simple, fast, verifiable, zero external dependencies. Doesn't survive an attacker who *also* controls the process that writes the log — they can forge a consistent chain. Pair it with periodic blockchain anchoring if that's your threat model.

For most SaaS products, the "boring hash chain in Postgres" is exactly the right ceiling: it detects the realistic tamper (someone with DB access) at zero extra ops cost, and it composes cleanly with blockchain anchoring later if you need it.

---

## Source

Full implementation: [ElwinErnst/securechain-vault](https://github.com/ElwinErnst/securechain-vault), inside the [Sytadel Suite](https://github.com/ElwinErnst/sentinel-suite) meta-repo (docker-compose + smoke tests + all four backend services + Astro landing).

Relevant files:

- [`vault-api/src/common/utils/audit-hash.util.ts`](https://github.com/ElwinErnst/securechain-vault/blob/main/vault-api/src/common/utils/audit-hash.util.ts) — `stableStringify` + `sha256Hex`
- [`vault-api/src/modules/audit/audit.service.ts`](https://github.com/ElwinErnst/securechain-vault/blob/main/vault-api/src/modules/audit/audit.service.ts) — `createChained`
- [`vault-api/src/common/interceptors/audit.interceptor.ts`](https://github.com/ElwinErnst/securechain-vault/blob/main/vault-api/src/common/interceptors/audit.interceptor.ts) — automatic cross-cutting logging
- [`vault-api/src/database/entities/audit-log.entity.ts`](https://github.com/ElwinErnst/securechain-vault/blob/main/vault-api/src/database/entities/audit-log.entity.ts) — the row shape

---

If you build something similar or spot a hole in this design, I want to hear it. The comments here (and the [repo issues](https://github.com/ElwinErnst/securechain-vault/issues)) are open.
