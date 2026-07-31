# Adding WebAuthn to a multi-tenant NestJS + Next.js app: what nobody tells you

Passwords in 2026 are the cheapest attacker surface you own. You rotate them, you salt them, you make them 12+ characters, you turn on rate limiting — and someone still phishes one out of a shared Notion doc and drains a tenant next Tuesday.

Passkeys (WebAuthn) fix the class of attacks. The credential can't leave the device, there's nothing to phish, and if a user loses the device they lose the passkey, not access to their whole password manager.

The docs make it sound like a weekend project. It's a weekend project *if* you already know the three or four things that trip you up. This post is those three or four things, with real code from a live multi-tenant NestJS + Next.js app.

Full implementation is public — [ElwinErnst/auth-api](https://github.com/ElwinErnst/auth-api) for the backend, [ElwinErnst/sentinel-suite](https://github.com/ElwinErnst/sentinel-suite) for the meta-repo with the frontend and docker-compose.

---

## What you're building

A user with a valid password + tenant should be able to:

1. Log in normally with password (unchanged).
2. From settings, register one or more passkeys (Face ID, Touch ID, Windows Hello, YubiKey, iCloud Keychain). Each with a friendly name.
3. Log in later using any registered passkey, without typing a password.
4. Rename or delete their passkeys.

Two decisions I made up front, because they change the whole shape:

- **Passkeys coexist with passwords, not replace them.** That's what Auth0, Clerk, 1Password all do. Users hate having their only login method suddenly break, and you want a graceful ramp for existing accounts.
- **Multi-device is the norm, not the edge case.** One user, N passkeys. Their MacBook Touch ID and their phone's Face ID are separate credentials, both valid, each with its own friendly name.

The endpoints end up looking like:

```
POST /passkeys/registration/begin      (JWT required)
POST /passkeys/registration/finish     (JWT required) - attestation verify + save
POST /passkeys/authentication/begin    (public)
POST /passkeys/authentication/finish   (public) - assertion verify + issue JWT
GET  /passkeys                          (JWT required) - my passkeys
PATCH /passkeys/:id                     (JWT required) - rename
DELETE /passkeys/:id                    (JWT required)
```

Four endpoints for the flow, three for management. The `begin` calls return WebAuthn options that the browser passes into `navigator.credentials.create()` or `.get()`. The `finish` calls take the browser's attestation/assertion, verify it server-side, and either persist the credential (registration) or issue a session (authentication).

---

## The library

Don't hand-roll WebAuthn. The protocol has attestation formats, CBOR decoding, COSE keys, ES256/RS256/EdDSA signature verification, and a spec that keeps evolving. Every language ecosystem has one battle-tested library — in Node/TypeScript it's [@simplewebauthn/server](https://simplewebauthn.dev) for the backend and [@simplewebauthn/browser](https://simplewebauthn.dev) for the frontend. Both from the same author, both v13 at time of writing, both well-maintained.

Install:

```bash
# backend
yarn add @simplewebauthn/server

# frontend
npm install @simplewebauthn/browser
```

Everything below builds on those four exported functions:

- `generateRegistrationOptions()` — server, returns options for `navigator.credentials.create()`
- `verifyRegistrationResponse()` — server, verifies the attestation
- `generateAuthenticationOptions()` — server, returns options for `navigator.credentials.get()`
- `verifyAuthenticationResponse()` — server, verifies the assertion

---

## Data model

Two tables. First the passkeys themselves:

```typescript
@Index(['userId'])
@Entity('user_passkeys')
export class UserPasskey {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid', name: 'user_id' })
  userId!: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user!: User;

  @Index({ unique: true })
  @Column({ type: 'bytea', name: 'credential_id' })
  credentialId!: Buffer;

  @Column({ type: 'bytea', name: 'public_key' })
  publicKey!: Buffer;

  @Column({ type: 'bigint', default: 0 })
  counter!: string;

  @Column({ type: 'text', array: true, default: () => "'{}'" })
  transports!: string[];

  @Column({ type: 'varchar', length: 20, name: 'device_type' })
  deviceType!: 'singleDevice' | 'multiDevice';

  @Column({ type: 'boolean', name: 'backed_up', default: false })
  backedUp!: boolean;

  @Column({ type: 'varchar', length: 80, name: 'friendly_name' })
  friendlyName!: string;

  @Column({ type: 'timestamptz', name: 'last_used_at', nullable: true })
  lastUsedAt!: Date | null;

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz', name: 'updated_at' })
  updatedAt!: Date;
}
```

The gotchas here are subtle but real:

- **`credentialId` is `bytea`, not `text`.** WebAuthn credential IDs are raw bytes. You can encode them as base64url for transport, but store them as bytes so the unique index does the right thing regardless of encoding drift.
- **`counter` is `bigint` stored as `string`.** JavaScript's `Number` loses precision past 2^53. Most authenticators use small counters (or zero for iCloud-synced passkeys), but a compromised authenticator that reports a suspicious jump is exactly what you need to detect — don't lose precision.
- **`transports`, `deviceType`, `backedUp`** all come from the browser's attestation response. You need `deviceType` and `backedUp` to render sensible UX later ("This passkey is synced across your Apple devices" vs "This YubiKey lives on one physical stick").
- **No unique constraint on `(userId, friendlyName)`.** Users can name two passkeys the same thing if they want. The unique constraint is on the credential ID, not the label.

Second table: challenges.

```typescript
@Entity('webauthn_challenges')
export class WebauthnChallenge {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 16 })
  kind!: 'registration' | 'authentication';

  @Column({ type: 'uuid', name: 'user_id', nullable: true })
  userId!: string | null;

  @Column({ type: 'text' })
  challenge!: string;

  @Column({ type: 'timestamptz', name: 'expires_at' })
  expiresAt!: Date;

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt!: Date;
}
```

Challenges are one-shot, short-lived (5 minutes here), and tied to a `kind` + `userId` so a registration challenge can't be replayed against an authentication endpoint. Consumed on verify. Cleaned up lazily on the next save. No Redis needed.

---

## Registration: begin

```typescript
async registrationBegin(userId: string) {
  const user = await this.usersService.findById(userId);
  if (!user) throw new UnauthorizedException('User not found');

  const existing = await this.passkeys.find({ where: { userId } });

  const options = await generateRegistrationOptions({
    rpName: this.webauthn.rpName,
    rpID: this.webauthn.rpID,
    userName: user.email,
    userDisplayName:
      [user.firstName, user.lastName].filter(Boolean).join(' ') || user.email,
    userID: Buffer.from(user.id),
    attestationType: 'none',
    excludeCredentials: existing.map((c) => ({
      id: c.credentialId.toString('base64url'),
      transports: c.transports as AuthenticatorTransportFuture[],
    })),
    authenticatorSelection: {
      residentKey: 'preferred',
      userVerification: 'preferred',
    },
  });

  await this.saveChallenge('registration', userId, options.challenge);
  return options;
}
```

Three details that matter:

**`excludeCredentials` is not optional if you care about UX.** If you don't pass the user's existing credentials, the browser will happily let them register the same authenticator twice. On second use they'll try one, it'll work, they'll try the other, it'll also work, and they'll never know they have two identical entries with different friendly names cluttering their list. Pass the exclude list and the browser will grey out already-registered authenticators.

**`attestationType: 'none'` is almost always what you want.** Full attestation gives you the manufacturer's certificate for the authenticator ("this really is a YubiKey 5C serial ABC123"), which sounds cool but adds complexity, storage, and legal considerations (some jurisdictions treat that as PII). `none` still verifies the passkey works — you just skip the "which brand of authenticator was this" question.

**`residentKey: 'preferred'` enables discoverable credentials.** With this, the authenticator stores the user handle server-side, so a future authentication can happen *without* the user typing their email first. The browser lists eligible passkeys and the user picks. Setting this to `'required'` is stricter but locks out older security keys.

---

## Registration: finish

```typescript
async registrationFinish(
  userId: string,
  response: RegistrationResponseJSON,
  friendlyName: string,
): Promise<PasskeySummary> {
  if (!friendlyName || friendlyName.trim().length === 0) {
    throw new BadRequestException('friendlyName is required');
  }

  const stored = await this.consumeChallenge('registration', userId);

  const verification = await verifyRegistrationResponse({
    response,
    expectedChallenge: stored.challenge,
    expectedOrigin: this.webauthn.origins,
    expectedRPID: this.webauthn.rpID,
    requireUserVerification: false,
  });

  if (!verification.verified || !verification.registrationInfo) {
    throw new UnauthorizedException('Passkey registration failed');
  }

  const info = verification.registrationInfo;
  const credentialIdBuf = Buffer.from(info.credential.id, 'base64url');

  const duplicate = await this.passkeys.findOne({
    where: { credentialId: credentialIdBuf },
  });
  if (duplicate) {
    throw new BadRequestException('This passkey is already registered');
  }

  const row = this.passkeys.create({
    userId,
    credentialId: credentialIdBuf,
    publicKey: Buffer.from(info.credential.publicKey),
    counter: String(info.credential.counter ?? 0),
    transports: (info.credential.transports ?? []) as string[],
    deviceType: info.credentialDeviceType,
    backedUp: info.credentialBackedUp,
    friendlyName: friendlyName.trim().slice(0, 80),
    lastUsedAt: null,
  });

  return this.passkeys.save(row).then(this.toSummary);
}
```

The failure modes and how they're handled:

- **Expired or missing challenge** → `consumeChallenge` throws 401. Users see "session expired, try again."
- **Attestation verification fails** → 401. Includes the case where the browser sent an assertion for a different RP ID (someone tried to phish the flow from a lookalike domain).
- **Duplicate credential** → 400. Belt-and-suspenders on top of the `excludeCredentials` UX hint; if a user forces registration of an existing credential, we refuse cleanly.

Note the `credentialIdBuf` handling. The library returns `info.credential.id` as a **base64url string**, but we store bytes. Convert on the way in, convert on the way out when we hand it back to `excludeCredentials` or `allowCredentials`. Get this wrong in one direction and the unique index silently allows duplicates; get it wrong in the other and existing passkeys stop matching.

---

## Authentication: begin

```typescript
async authenticationBegin(email: string, tenantSlug: string) {
  const user = await this.usersService.findByEmailWithMemberships(email);
  const tenant = await this.tenantsService.findBySlug(tenantSlug);

  // Do not leak whether the user exists — always return options.
  const credentials =
    user && tenant
      ? await this.passkeys.find({ where: { userId: user.id } })
      : [];

  const options = await generateAuthenticationOptions({
    rpID: this.webauthn.rpID,
    allowCredentials: credentials.map((c) => ({
      id: c.credentialId.toString('base64url'),
      transports: c.transports as AuthenticatorTransportFuture[],
    })),
    userVerification: 'preferred',
  });

  await this.saveChallenge(
    'authentication',
    user?.id ?? null,
    options.challenge,
  );

  return options;
}
```

The critical property here — **user enumeration resistance** — comes from what the endpoint returns for a nonexistent email.

The wrong version (that everyone writes first) throws 404 when the user is missing. Which means an attacker can throw a wordlist at your endpoint and learn every email that has an account.

The right version, above, always returns the same shape. For a real user, `allowCredentials` contains their registered passkeys. For a nonexistent user, `allowCredentials` is empty. Same HTTP status, same response shape, same timing (a proper implementation would time-normalize this even further — this one relies on the DB lookup being uniformly fast).

The browser will then pop the passkey picker anyway; the user with real credentials will succeed, the phantom will see the picker do nothing. But no observer can tell from the outside which is which.

Small smoke test I ran to prove it:

```bash
$ curl -s -X POST /api/passkeys/authentication/begin \
    -d '{"email":"admin@test.com","tenantSlug":"sentinel-labs"}'
{"rpId":"localhost","challenge":"8Dh-...","allowCredentials":[],"timeout":60000,"userVerification":"preferred"}

$ curl -s -X POST /api/passkeys/authentication/begin \
    -d '{"email":"ghost@nowhere.com","tenantSlug":"sentinel-labs"}'
{"rpId":"localhost","challenge":"UJlC...","allowCredentials":[],"timeout":60000,"userVerification":"preferred"}
```

Same shape, different challenges, no clue which email exists.

---

## Authentication: finish

```typescript
async authenticationFinish(
  response: AuthenticationResponseJSON,
  tenantSlug: string,
  context?: { userAgent?: string | null; ip?: string | null },
): Promise<TokenPair> {
  const credentialIdBuf = Buffer.from(response.id, 'base64url');

  const passkey = await this.passkeys.findOne({
    where: { credentialId: credentialIdBuf },
  });
  if (!passkey) throw new UnauthorizedException('Unknown passkey');

  const stored = await this.consumeChallenge('authentication', passkey.userId);

  const verification = await verifyAuthenticationResponse({
    response,
    expectedChallenge: stored.challenge,
    expectedOrigin: this.webauthn.origins,
    expectedRPID: this.webauthn.rpID,
    credential: {
      id: response.id,
      publicKey: new Uint8Array(passkey.publicKey),
      counter: Number(passkey.counter),
      transports: passkey.transports as AuthenticatorTransportFuture[],
    },
    requireUserVerification: false,
  });

  if (!verification.verified) {
    throw new UnauthorizedException('Passkey authentication failed');
  }

  const newCounter = verification.authenticationInfo.newCounter;
  if (newCounter <= Number(passkey.counter) && newCounter !== 0) {
    throw new UnauthorizedException(
      'Authenticator counter did not advance (possible cloned key)',
    );
  }

  passkey.counter = String(newCounter);
  passkey.lastUsedAt = new Date();
  await this.passkeys.save(passkey);

  // From here, mirror the tail of a normal password login:
  // resolve tenant, membership, create session, sign token pair.
  const tenant = await this.tenantsService.findBySlug(tenantSlug);
  if (!tenant) throw new UnauthorizedException('Tenant is required');

  const membership = await this.membershipsService.findActiveMembership(
    passkey.userId,
    tenant.id,
  );
  if (!membership) {
    throw new UnauthorizedException('User has no access to this tenant');
  }

  const refreshExpiresAt = this.tokenService.buildRefreshExpiryDate();
  const session = await this.sessionsService.createEmpty({ /* … */ });
  const tokenPair = await this.tokenService.generateTokenPair({ /* … */ });
  await this.sessionsService.updateRefreshToken(session.id, tokenPair.refreshToken);

  return tokenPair;
}
```

Three things earn their weight here:

**Counter validation catches cloned authenticators.** WebAuthn spec says the authenticator's counter must monotonically increase across uses. If the same passkey shows up with `newCounter <= stored.counter` (and it's not zero, since iCloud-synced passkeys report zero), that's the fingerprint of somebody cloning the authenticator's storage. Reject and burn the session.

**The `credential` object is what the library uses to verify the signature.** The public key comes from your DB, the counter comes from your DB. If you pass zeros or the wrong values, verification fails silently (no error, just `verified: false`). If your DB has drift here, nothing about the error message will tell you why.

**Everything after `verified: true` is a normal login.** Once WebAuthn has proven "this is really the user who owns credential X," you're back in familiar auth territory: resolve tenant, load membership, mint a session, hand back a token pair. This is why the passkey module depends on the existing `TokenService` and `SessionsService` — no need to duplicate that logic.

---

## The frontend piece

Server-only won't work here. `navigator.credentials.create()` and `.get()` are browser APIs — they must run in a client component. In a Next.js App Router world that means client components + server actions, with the WebAuthn calls sandwiched between:

```tsx
'use client';

import { startAuthentication } from '@simplewebauthn/browser';
import { passkeyLoginBeginAction, passkeyLoginFinishAction } from './passkey-actions';

export function PasskeyLoginButton() {
  const [email, setEmail] = useState('');
  const [tenantSlug, setTenantSlug] = useState('sentinel-labs');

  async function onSignIn() {
    // 1. Ask server for options
    const options = await passkeyLoginBeginAction({ email, tenantSlug });

    // 2. Browser talks to authenticator (Touch ID prompt appears here)
    const response = await startAuthentication({ optionsJSON: options });

    // 3. Send assertion to server; server verifies + sets session cookies
    const result = await passkeyLoginFinishAction({ response, tenantSlug });
    if (result.ok) router.push('/app');
  }

  return <button onClick={onSignIn}>Sign in with passkey</button>;
}
```

The server actions do the auth-api round-trip and, on success, set HttpOnly session cookies before returning `{ ok: true }`. The pattern is nice because it keeps tokens off the client — the browser never sees the JWT, only the `Set-Cookie` header.

One footgun worth calling out: `startAuthentication` and `startRegistration` in v13 take `{ optionsJSON: options }` — not `options` directly. It's a wrapper introduced to give the library room to add more parameters. If you copy older docs (or an LLM autocompletes from them), you get an inscrutable type error.

---

## Security properties, in one place

What this design actually gives you:

- **No user enumeration.** `authentication/begin` returns the same shape for real and fake emails.
- **Phishing resistance.** WebAuthn ties the credential to the exact origin. A lookalike domain (`sytadεl-labs.com`) will not produce a valid assertion, because the RP ID is baked into the signature.
- **Replay resistance per session.** Challenges are one-shot and consumed on verify.
- **Cloned-authenticator detection.** Counter regression is rejected.
- **Credential-level revocation.** Delete one passkey from settings, only that device stops working. The password and other passkeys stay live.
- **No secret material stored server-side.** All you have is the public key. A DB dump reveals nothing an attacker can use to authenticate.

What it deliberately doesn't do:

- **Doesn't kill passwords.** Coexistence, not replacement. That's a UX call — you can make it stricter (`requireUserVerification: 'required'` + phase out password support once N% of users have a passkey), but rushing this locks people out.
- **Doesn't verify user identity end-to-end.** The passkey proves possession of a specific device, not that the human at the keyboard is your user. Combine with device attestation or step-up flows if you need higher assurance for sensitive operations.

---

## Tradeoffs vs the alternatives

**TOTP (Google Authenticator / Authy).** Better than passwords, worse than passkeys. Still phishable — the six-digit code can be socially engineered onto a fake login page. Also requires the user to reach for their phone every login. Good as a "step-up" second factor, not great as a primary.

**Magic links.** Zero friction, zero security. Anyone with access to the user's inbox owns the account. Fine for low-value applications, unacceptable for anything a security team needs to defend.

**SMS.** Please don't. SIM swaps are cheap, SS7 is a joke, and telcos have breached SMS databases multiple times. NIST retired SMS as a valid second factor in 2020.

**Passwords + hardware token (U2F).** A subset of what passkeys give you, with worse UX. If you're building today, WebAuthn/passkeys are the strictly-better version of everything U2F does.

**Passkeys as the only login method.** The direction the industry is moving, but too aggressive right now. Users lose devices, IT admins need break-glass access, and if your only auth path is a passkey and the authenticator dies, you're staring at an account recovery flow you probably haven't built yet. Ship coexistence first, tighten later.

---

## Source

- Backend: [`auth/auth-api/src/modules/passkeys/`](https://github.com/ElwinErnst/auth-api/tree/main/src/modules/passkeys) in [ElwinErnst/auth-api](https://github.com/ElwinErnst/auth-api)
- Frontend: [`sentinel-app/src/features/auth/`](https://github.com/ElwinErnst/sentinel-suite/tree/main/sentinel-app/src/features/auth) in [ElwinErnst/sentinel-suite](https://github.com/ElwinErnst/sentinel-suite)
- Runnable end-to-end: `docker compose up --build` from the meta-repo, then `http://localhost:3003/login`

If you spot a hole in this design or hit an edge case I didn't cover, drop it in the [repo issues](https://github.com/ElwinErnst/sentinel-suite/issues) or in the comments — I want to hear it.
