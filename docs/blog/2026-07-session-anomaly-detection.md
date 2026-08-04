# Session anomaly detection in a multi-tenant auth service — with the real bugs I hit

Account takeovers rarely announce themselves. What you see in the logs is a valid login. Correct email, correct password (or these days, correct passkey assertion). The attacker doesn't need to break the crypto — they got the credential from a paste dump, a phishing hit, or an old device that was never wiped.

The only thing that gives them away, most of the time, is *context*. The login is from a country the user has never been in. The IP is fresh. The browser fingerprint doesn't match. A lot of "how did that happen" incidents are provable in retrospect from these signals — if you were bothering to collect and score them.

This post walks through a small, pragmatic session anomaly detector I added to a multi-tenant NestJS auth service. Heuristics, not ML. The whole thing is ~180 lines of TypeScript plus a Postgres table.

Full implementation lives at [ElwinErnst/auth-api](https://github.com/ElwinErnst/auth-api).

---

## What "anomaly" means here

Three signals, scored:

- **New IP** — the source IP has never been seen for this user in the last 90 days. `+30`.
- **New country** — the geo-resolved country has never been seen. `+40`.
- **New browser/OS fingerprint** — coarse fingerprint (e.g. `chrome|macintosh`) never seen. `+10`.

Total: 0–80. Bucketed into:

- `< 40` → `info` (not stored, no signal)
- `40–69` → `warning` (stored, logged)
- `≥ 70` → `critical` (stored, logged as WARN, dashboard-worthy)

Deliberately excluded from this MVP: **hour-of-day baseline**. It's tempting — "logging in at 3am is weird if you always log in at 10" — but it requires a mature baseline to work. With five logins of history, quartiles are noise. When there are enough data points to make it meaningful, adding it is a follow-up.

Also deliberately excluded: **any ML/LLM classifier**. Rules produce boring, explainable, auditable results. An LLM classifier is the natural next layer — you use it to *rank* anomalies the rules already found, not to replace them.

---

## Data model

One table for anomaly events. Sessions live in their own table (the one we already have for refresh token rotation), and we query them for the history baseline.

```typescript
@Index(['userId', 'createdAt'])
@Entity('session_anomaly_events')
export class SessionAnomalyEvent {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid', name: 'user_id' })
  userId!: string;

  @Column({ type: 'uuid', name: 'tenant_id', nullable: true })
  tenantId!: string | null;

  @Column({ type: 'uuid', name: 'session_id', nullable: true })
  sessionId!: string | null;

  @Column({ type: 'text', nullable: true })
  ip!: string | null;

  @Column({ type: 'varchar', length: 3, nullable: true })
  country!: string | null;

  @Column({ type: 'varchar', length: 120, nullable: true })
  city!: string | null;

  @Column({ type: 'text', name: 'user_agent', nullable: true })
  userAgent!: string | null;

  @Column({ type: 'int' })
  score!: number;

  @Column({ type: 'jsonb', default: () => "'[]'" })
  flags!: string[];

  @Column({ type: 'varchar', length: 16 })
  severity!: 'info' | 'warning' | 'critical';

  @Column({ type: 'varchar', length: 40, name: 'login_kind' })
  loginKind!: 'password' | 'passkey';

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt!: Date;
}
```

Notes worth calling out:

- **`severity` is stored** even though it's derivable from `score`. Trades a few bytes for indexable filtering: "give me everything critical from the last week" is a `WHERE severity = 'critical' AND created_at > ...` instead of `WHERE score >= 70 AND ...`. Cheap to have.
- **`login_kind`** discriminates password vs. passkey. Passkey logins with `new_ip + new_country` are less alarming (users add passkeys from new devices routinely). Rules could weight them differently in v2.
- **`session_id` nullable** because failed authentications will eventually flow through this table too (a login attempt that never made it to a session).

---

## The core: `analyze()`

```typescript
async analyze(input: AnalyzeInput): Promise<AnomalyResult> {
  const normalizedIp = normalizeIp(input.ip);
  const geo = normalizedIp ? geoip.lookup(normalizedIp) : null;
  const country = geo?.country ?? null;
  const uaFingerprint = fingerprintUserAgent(input.userAgent);

  const flags: string[] = [];
  let score = 0;

  const since = new Date(Date.now() - HISTORY_WINDOW_DAYS * 86400 * 1000);
  const history = await this.sessions.find({
    where: {
      userId: input.userId,
      createdAt: MoreThan(since),
      // Exclude the just-created session so we compare against previous
      // attempts, not against ourselves.
      ...(input.sessionId ? { id: Not(input.sessionId) } : {}),
    },
    order: { createdAt: 'DESC' },
    take: 50,
  });

  if (history.length === 0) {
    flags.push('first_login');
  } else {
    const seenIps = new Set(
      history.map((s) => normalizeIp(s.ip)).filter((v): v is string => !!v),
    );
    const seenCountries = new Set<string>();
    const seenUaFingerprints = new Set<string>();

    for (const s of history) {
      const ipNorm = normalizeIp(s.ip);
      if (ipNorm) {
        const g = geoip.lookup(ipNorm);
        if (g?.country) seenCountries.add(g.country);
      }
      const fp = fingerprintUserAgent(s.userAgent);
      if (fp) seenUaFingerprints.add(fp);
    }

    if (normalizedIp && !seenIps.has(normalizedIp)) {
      flags.push('new_ip');
      score += 30;
    }
    if (country && !seenCountries.has(country)) {
      flags.push('new_country');
      score += 40;
    }
    if (uaFingerprint && !seenUaFingerprints.has(uaFingerprint)) {
      flags.push('new_user_agent');
      score += 10;
    }
  }

  const severity =
    score >= 70 ? 'critical' : score >= 40 ? 'warning' : 'info';

  if (severity !== 'info') {
    await this.events.save(
      this.events.create({
        userId: input.userId,
        tenantId: input.tenantId,
        sessionId: input.sessionId,
        ip: normalizedIp,
        country,
        city: geo?.city ?? null,
        userAgent: input.userAgent,
        score,
        flags,
        severity,
        loginKind: input.loginKind,
      }),
    );
    this.logger.warn(
      `Session anomaly [${severity}] user=${input.userId} score=${score} flags=${flags.join(',')} ip=${normalizedIp} country=${country}`,
    );
  }

  return { score, flags, severity, country, city: geo?.city ?? null };
}
```

The two helpers keep the logic honest:

```typescript
function normalizeIp(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const trimmed = raw.split(',')[0]?.trim();
  if (!trimmed) return null;
  if (trimmed.startsWith('::ffff:')) return trimmed.slice(7);  // IPv4-mapped IPv6
  return trimmed;
}

function fingerprintUserAgent(ua: string | null | undefined): string | null {
  if (!ua) return null;
  const browser =
    ua.match(/(Chrome|Firefox|Safari|Edge|Opera|CriOS|FxiOS)/i)?.[1] ?? 'unknown';
  const os =
    ua.match(/(Windows|Mac OS X|Macintosh|Linux|Android|iPhone|iPad|iOS)/i)?.[1] ?? 'unknown';
  return `${browser.toLowerCase()}|${os.toLowerCase()}`;
}
```

The user-agent fingerprint is *coarse* on purpose. If we compared full UAs, every Chrome minor version bump would trip `new_user_agent` and drown the signal in noise. `chrome|macintosh` remains stable across Chrome 118, 119, 120, and flags the case that actually matters: same user, different platform.

---

## Hooking it in

The analyzer runs at the very end of each successful login, both for the password path and for the WebAuthn / passkey path:

```typescript
// auth.service.login (password)
const session = await this.sessionsService.createEmpty({ userId, tenantId, ... });

await this.anomalyService.analyze({
  userId: user.id,
  tenantId: membership.tenantId,
  sessionId: session.id,
  ip: context?.ip ?? null,
  userAgent: context?.userAgent ?? null,
  loginKind: 'password',
});

const tokenPair = await this.tokenService.generateTokenPair({ ... });
```

```typescript
// passkeys.service.authenticationFinish (WebAuthn)
const session = await this.sessionsService.createEmpty({ ... });

await this.anomalyService.analyze({
  userId: passkey.userId,
  tenantId: tenant.id,
  sessionId: session.id,
  ip: context?.ip ?? null,
  userAgent: context?.userAgent ?? null,
  loginKind: 'passkey',
});
```

Deliberately *not* wired to block the login. This is a detection layer. A future iteration can add step-up MFA on `critical` — force a device confirmation or a magic link before the session becomes fully privileged — but that's product surface, not detection logic. Ship the detection first, then argue about the reaction.

The endpoint to read the flagged history:

```typescript
@UseGuards(AccessJwtGuard)
@Get('/sessions/anomalies')
list(@CurrentAuth() auth: AccessTokenPayload, @Query('limit') limit?: string) {
  const parsed = limit ? Math.min(Math.max(Number(limit), 1), 200) : 50;
  return this.service.listForUser(auth.sub, parsed);
}
```

---

## Four bugs I hit while building this — worth the specifics

Sharing these because "read the docs and it worked" is not what this actually looks like.

### 1. `geoip-lite@2.x` requires Node ≥24

I added `yarn add geoip-lite` and the local test passed on Node 26. Docker container (`node:20-bookworm-slim`) failed the build with:

```
error geoip-lite@2.0.3: The engine "node" is incompatible with this module.
Expected version ">=24.0.0". Got "20.20.2"
```

Fix: pinned to `1.4.10`, which supports Node 12+. The 2.x branch is only a few weeks old and hasn't been the default for long enough to notice.

### 2. `import geoip from 'geoip-lite'` returned undefined

TypeScript compiled fine because `allowSyntheticDefaultImports: true`. At runtime the default import was undefined, because the project didn't have `esModuleInterop: true` — the two flags look similar but they're not the same.

Fix: `import * as geoip from 'geoip-lite'` (namespace import). Same result at compile time, works at runtime with a CommonJS module.

The error was subtle: `TypeError: Cannot read properties of undefined (reading 'lookup')` at the exact point we called `geoip.lookup(ip)`. If you're getting that from any Node library, this is the first suspect.

### 3. Express ignored `X-Forwarded-For`

The smoke test looked like it should work: `curl -H 'X-Forwarded-For: 8.8.8.8' ...`. But every session recorded the same internal Docker network IP. Because Express, by default, treats `req.ip` as the immediate hop unless you explicitly opt into trusting proxies.

Fix, in `main.ts`:

```typescript
(app.getHttpAdapter().getInstance() as unknown as {
  set: (k: string, v: unknown) => void;
}).set('trust proxy', true);
```

One line. In a real deployment, you want to be more surgical about *which* proxies you trust (see [Express docs on trust proxy](https://expressjs.com/en/guide/behind-proxies.html)), but for a demo behind a Docker gateway or a known reverse proxy, `true` is fine.

### 4. The analyzer saw the current session as history

This one took the longest to spot. Logins from `8.8.8.8` and `195.85.234.5` (Russia) were producing `score = 0, severity = info, flags = []`. The IPs were being stored correctly — I could see them in `SELECT ip FROM sessions ORDER BY created_at DESC` — but the analyzer decided nothing was new.

The reason: `sessionsService.createEmpty()` runs *before* `anomalyService.analyze()`. So when the analyzer queries `sessions WHERE user_id = $1`, the just-created session (with the new IP, new country, new UA) is in the result set. Every "seen IPs" contains the current IP. Every "seen countries" contains the current country. Nothing is ever new.

Fix:

```typescript
where: {
  userId: input.userId,
  createdAt: MoreThan(since),
  ...(input.sessionId ? { id: Not(input.sessionId) } : {}),
},
```

Exclude the current session from history. After that, a login from a fresh IP produced `score=40 severity=warning flags=[new_ip, new_user_agent]`, and a login from Japan produced `score=70 severity=critical flags=[new_ip, new_country]`. Exactly what you want.

---

## Tradeoffs vs. the LLM/ML approach

An anomaly detection engineer at a bigger company will look at this and say: "why not train a model?" Answers:

- **Latency.** This runs synchronously in the login path. Adding an LLM call at 300–1500 ms per request is a real UX regression. If you *must* do it, do it async and mark the session as "under review" until the score comes back.
- **Cost.** At $1–$5 per million tokens, a classifier scoring every login for a moderately-sized SaaS becomes real money surprisingly fast.
- **Explainability.** When your CISO asks "why did we flag this user," pointing at `flags: ['new_ip', 'new_country']` and a hardcoded scoring rule is much more defensible than "the model said so."
- **Evaluation.** Rules give you deterministic outputs. You can write unit tests that say "this input MUST produce this score." Try that with a classifier.

The right place for ML/LLM is *ranking* — take the top-N warnings/criticals produced by the rules, feed them to a classifier that decides "this looks like a legitimate travel + new phone" vs "this looks like a compromise," and page a human on the high-confidence-critical bucket.

---

## What this doesn't cover (and shouldn't yet)

- **Impossible-travel detection** (login from Buenos Aires at 10:00, login from Tokyo at 10:05). Nice to have; requires joining consecutive events, non-trivial in SQL but doable. Deferred.
- **Device binding** (a token that only works from the device it was issued on). WebAuthn already gives you a version of this through credential IDs; adding it at the session cookie level is more invasive.
- **Block-on-critical.** Detection ≠ prevention. Blocking on `critical` without a smooth step-up path locks out real users who took a real trip. Ship the reaction as a separate feature with its own UX flow.

---

## Source

- Analyzer + scoring: [`src/modules/session-anomaly/session-anomaly.service.ts`](https://github.com/ElwinErnst/auth-api/blob/main/src/modules/session-anomaly/session-anomaly.service.ts)
- Entity: [`src/modules/session-anomaly/entities/session-anomaly-event.entity.ts`](https://github.com/ElwinErnst/auth-api/blob/main/src/modules/session-anomaly/entities/session-anomaly-event.entity.ts)
- Login hook (password + passkey): both `auth.service.ts` and `passkeys.service.ts` in the same repo
- Trust-proxy setup: [`src/main.ts`](https://github.com/ElwinErnst/auth-api/blob/main/src/main.ts)
- Meta-repo + docker-compose to run it locally: [ElwinErnst/sytadel-suite](https://github.com/ElwinErnst/sytadel-suite)

If you're building something similar and hit a bug I didn't cover, open an issue on the repo — I collect them for the follow-up post.
