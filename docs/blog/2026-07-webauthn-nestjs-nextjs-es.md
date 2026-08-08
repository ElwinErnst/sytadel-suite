# Agregar WebAuthn a una aplicación multi-tenant con NestJS y Next.js: lo que nadie te cuenta

En 2026, las contraseñas siguen siendo una de las superficies de ataque más baratas. Podés rotarlas, exigir doce caracteres, agregar salt, rate limiting y todas las políticas imaginables; alcanza con que alguien entregue una en un sitio de phishing para que el resto deje de importar.

Las passkeys cambian ese modelo. La aplicación guarda una clave pública, mientras que la credencial privada permanece bajo control del autenticador. Además, WebAuthn vincula la credencial con el RP ID y el origen esperado, por lo que una página parecida visualmente no puede producir una assertion válida para tu dominio.

La documentación hace que parezca un proyecto de fin de semana. Puede serlo, siempre que conozcas de antemano los detalles que suelen romper la implementación. Este artículo reúne esos puntos usando código real de una aplicación multi-tenant construida con NestJS y Next.js.

La implementación completa está en [ElwinErnst/auth-api](https://github.com/ElwinErnst/auth-api) para el backend y en [ElwinErnst/sytadel-suite](https://github.com/ElwinErnst/sytadel-suite) para el frontend y Docker Compose.

---

## Qué vamos a construir

Un usuario autenticado mediante contraseña y tenant puede:

1. Seguir iniciando sesión con contraseña.
2. Registrar una o más passkeys desde Settings y asignarles un nombre amigable.
3. Iniciar sesión posteriormente con cualquiera de ellas, sin escribir la contraseña.
4. Listar, renombrar y eliminar sus passkeys.

Hay dos decisiones importantes:

- **Las passkeys conviven con las contraseñas.** No reemplazamos de golpe el mecanismo existente ni forzamos una recuperación traumática cuando alguien pierde un dispositivo.
- **Un usuario puede registrar N credenciales independientes.** Touch ID de la MacBook, Face ID del teléfono y una YubiKey son credenciales separadas, todas válidas y con su propio nombre.

El API queda así:

```text
POST   /passkeys/registration/begin      JWT required
POST   /passkeys/registration/finish     JWT required
POST   /passkeys/authentication/begin    public
POST   /passkeys/authentication/finish   public
GET    /passkeys                          JWT required
PATCH  /passkeys/:id                     JWT required
DELETE /passkeys/:id                     JWT required
```

Los endpoints `begin` generan las opciones que consume el navegador. Los endpoints `finish` validan la attestation o assertion en el servidor y, si corresponde, guardan la credencial o crean la sesión normal de la aplicación.

---

## No implementes WebAuthn a mano

WebAuthn incluye CBOR, claves COSE, múltiples algoritmos, formatos de attestation y validaciones de origen. Implementarlo desde cero es una excelente manera de crear una vulnerabilidad difícil de detectar.

En Node.js usamos:

```bash
# Backend
yarn add @simplewebauthn/server

# Frontend
npm install @simplewebauthn/browser
```

La solución se apoya principalmente en cuatro funciones:

- `generateRegistrationOptions()`
- `verifyRegistrationResponse()`
- `generateAuthenticationOptions()`
- `verifyAuthenticationResponse()`

Backend y frontend utilizan SimpleWebAuthn v13.

---

## Modelo de datos

Necesitamos una tabla para las credenciales y otra para los challenges.

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
}
```

Hay varios detalles que importan:

- `credentialId` se guarda como bytes, no como texto. Base64url es el formato de transporte; no debería convertirse en la identidad persistida.
- El índice único pertenece al credential ID. Dos passkeys pueden compartir el mismo nombre amigable.
- `counter` es `bigint` en PostgreSQL, pero SimpleWebAuthn recibe un `number`. Antes de cruzar ese límite se valida que el valor sea un entero seguro, no negativo y representable por JavaScript.
- `deviceType` y `backedUp` describen propiedades de la credencial informadas por el autenticador. No significan que dos dispositivos físicos registrados por el usuario compartan necesariamente el mismo credential ID.

Los challenges son breves y de un solo uso:

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
}
```

El TTL es de cinco minutos. `kind` impide usar un challenge de registro en autenticación. Las filas expiradas se limpian de manera perezosa durante el siguiente guardado.

---

## Registro: begin

El usuario ya debe tener una sesión válida.

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
    excludeCredentials: existing.map((credential) => ({
      id: credential.credentialId.toString('base64url'),
      transports: credential.transports,
    })),
    authenticatorSelection: {
      residentKey: 'required',
      userVerification: 'required',
    },
  });

  await this.saveChallenge('registration', userId, options.challenge);
  return options;
}
```

### `excludeCredentials`

Evita que el usuario intente registrar nuevamente una credencial que ya existe. Es una protección de UX; la restricción única de la base sigue siendo la defensa definitiva.

### `attestationType: 'none'`

Queremos comprobar que la credencial funciona, no identificar marca, modelo o certificado del autenticador. La attestation completa agrega complejidad y puede introducir datos considerados sensibles.

### Credenciales detectables y verificación local

`residentKey: 'required'` garantiza que la autenticación pueda usar `allowCredentials: []` sin enviar IDs registrados al cliente. El costo es que autenticadores antiguos sin credenciales residentes quedan fuera.

`userVerification: 'required'` exige PIN, biometría u otro mecanismo local equivalente.

---

## Registro: finish

La respuesta del navegador se verifica dentro de la misma transacción que protege y consume el challenge.

```typescript
async registrationFinish(userId, response, friendlyName) {
  return this.withChallenge('registration', userId, async (stored, manager) => {
    const verification = await verifyRegistrationResponse({
      response,
      expectedChallenge: stored.challenge,
      expectedOrigin: this.webauthn.origins,
      expectedRPID: this.webauthn.rpID,
      requireUserVerification: true,
    });

    if (!verification.verified || !verification.registrationInfo) {
      throw new UnauthorizedException('Passkey registration failed');
    }

    const repository = manager.getRepository(UserPasskey);
    const info = verification.registrationInfo;
    const credentialId = Buffer.from(info.credential.id, 'base64url');

    if (await repository.findOne({ where: { credentialId } })) {
      throw new BadRequestException('This passkey is already registered');
    }

    return repository.save(repository.create({
      userId,
      credentialId,
      publicKey: Buffer.from(info.credential.publicKey),
      counter: String(info.credential.counter ?? 0),
      transports: info.credential.transports ?? [],
      deviceType: info.credentialDeviceType,
      backedUp: info.credentialBackedUp,
      friendlyName: friendlyName.trim().slice(0, 80),
      lastUsedAt: null,
    }));
  });
}
```

La conversión base64url debe ser simétrica: texto durante el intercambio con WebAuthn, bytes dentro de PostgreSQL.

Si la verificación falla, la transacción hace rollback y conserva el challenge. Si termina correctamente, guarda la credencial y elimina el challenge en el mismo commit.

---

## Autenticación: begin sin filtrar credenciales

El error clásico es devolver 404 cuando el email no existe o incluir `allowCredentials` solamente para usuarios registrados. Ambos comportamientos crean un canal de enumeración.

```typescript
async authenticationBegin(email: string, tenantSlug: string) {
  const startedAt = performance.now();
  const user = await this.usersService.findByEmailWithMemberships(email);

  const options = await generateAuthenticationOptions({
    rpID: this.webauthn.rpID,
    allowCredentials: [],
    userVerification: 'required',
  });

  await this.saveChallenge(
    'authentication',
    user?.id ?? null,
    options.challenge,
  );
  await this.waitForAuthenticationBeginFloor(startedAt);
  return options;
}
```

La forma pública es la misma para una cuenta real y una inexistente: mismo status, mismas propiedades y lista vacía. Las credenciales detectables permiten que el navegador encuentre las passkeys sin recibir IDs desde el servidor.

Además, la respuesta respeta un piso temporal configurable —250 ms por defecto— para reducir diferencias observables entre ambas rutas. No pretende eliminar todo canal lateral posible bajo cualquier carga, pero evita convertir el lookup más rápido en un oracle trivial.

---

## Autenticación: finish

Primero resolvemos el credential ID y después entramos en la transacción protegida:

```typescript
async authenticationFinish(response, tenantSlug, context) {
  const credentialId = Buffer.from(response.id, 'base64url');
  const candidate = await this.passkeys.findOne({ where: { credentialId } });
  if (!candidate) throw new UnauthorizedException('Unknown passkey');

  const verifiedPasskey = await this.withChallenge(
    'authentication',
    candidate.userId,
    async (stored, manager) => {
      const repository = manager.getRepository(UserPasskey);
      const locked = await repository.findOne({
        where: { id: candidate.id },
        lock: { mode: 'pessimistic_write' },
      });
      if (!locked) throw new UnauthorizedException('Unknown passkey');

      const storedCounter = this.parseAuthenticatorCounter(locked.counter);
      const verification = await verifyAuthenticationResponse({
        response,
        expectedChallenge: stored.challenge,
        expectedOrigin: this.webauthn.origins,
        expectedRPID: this.webauthn.rpID,
        credential: {
          id: response.id,
          publicKey: new Uint8Array(locked.publicKey),
          counter: storedCounter,
          transports: locked.transports,
        },
        requireUserVerification: true,
      });

      if (!verification.verified) {
        throw new UnauthorizedException('Passkey authentication failed');
      }

      const newCounter = verification.authenticationInfo.newCounter;
      if (!Number.isSafeInteger(newCounter) || newCounter < 0) {
        throw new UnauthorizedException('Unsupported authenticator counter');
      }
      if (newCounter !== 0 && newCounter <= storedCounter) {
        throw new UnauthorizedException('Authenticator counter did not advance');
      }

      locked.counter = String(newCounter);
      locked.lastUsedAt = new Date();
      return repository.save(locked);
    },
  );

  // Resolve tenant + membership, create session, run anomaly analysis,
  // mint access/refresh tokens and persist refresh-token state.
}
```

El counter ayuda a detectar replay o clonación en autenticadores que mantienen un contador creciente. No es universal: las passkeys sincronizadas suelen informar cero.

Después de `verified: true`, el resto es un login convencional: validar tenant y membership, crear una sesión, ejecutar el análisis de anomalías y emitir access y refresh tokens.

---

## Challenges realmente de un solo uso

La transacción necesita serializarse antes de leer el challenge. Una prueba con PostgreSQL real mostró que depender solamente de `FOR UPDATE` podía permitir que una segunda transacción esperara y luego continuara con una vista obsoleta de la fila eliminada.

La solución toma un advisory lock transaccional antes del `SELECT`:

```typescript
await manager.query(
  'SELECT pg_advisory_xact_lock(hashtextextended($1, 0))',
  [`${kind}:${userId ?? 'anonymous'}`],
);
```

Después se selecciona la fila mediante `pessimistic_write`. Si la verificación falla, todo hace rollback y el challenge permanece disponible. Si funciona, el cambio de credencial y la eliminación del challenge se confirman juntos.

La prueba E2E abre conexiones PostgreSQL concurrentes y demuestra que solamente una transacción puede consumir el challenge.

---

## El frontend con Next.js

`navigator.credentials.create()` y `.get()` son APIs del navegador. Por eso la llamada a SimpleWebAuthn vive en un client component, mientras que la comunicación con el auth API y las cookies quedan en server actions.

```tsx
'use client';

import { startAuthentication } from '@simplewebauthn/browser';

export function PasskeyLoginButton() {
  const [email, setEmail] = useState('');
  const [tenantSlug, setTenantSlug] = useState('sentinel-labs');

  async function onSignIn() {
    const options = await passkeyLoginBeginAction({ email, tenantSlug });
    const response = await startAuthentication({ optionsJSON: options });
    const result = await passkeyLoginFinishAction({ response, tenantSlug });

    if (result.ok) router.push('/app');
  }

  return <button onClick={onSignIn}>Sign in with passkey</button>;
}
```

En SimpleWebAuthn v13, `startAuthentication` y `startRegistration` reciben `{ optionsJSON: options }`, no el objeto options directamente.

La server action recibe el par de tokens del auth API, consulta el perfil y configura cookies `HttpOnly`. Los tokens no se exponen al JavaScript del navegador.

Settings utiliza el mismo patrón para registrar, listar, renombrar y eliminar credenciales.

---

## Propiedades de seguridad

Esta implementación ofrece:

- **Resistencia a enumeración:** misma forma pública y un piso temporal común en authentication begin.
- **Resistencia al phishing:** se validan RP ID y origen esperado.
- **Replay resistance:** cada challenge expira, pertenece a un tipo de operación y sólo puede confirmarse una vez.
- **User verification obligatoria:** PIN, biometría o mecanismo equivalente.
- **Control de counters:** se rechazan valores inválidos, fuera del rango seguro o regresiones no nulas.
- **Revocación por credencial:** eliminar una passkey no invalida las demás ni la contraseña.
- **Sin secretos de autenticación en el servidor:** se persiste la clave pública, no la privada.
- **Aislamiento multi-tenant:** después de verificar la credencial se vuelve a validar tenant y membership antes de emitir la sesión.

La cobertura incluye tests unitarios de invariantes y una prueba E2E contra PostgreSQL real para la concurrencia del challenge.

---

## Lo que deliberadamente no resuelve

- No elimina las contraseñas ni implementa recuperación passwordless completa.
- No convierte el counter en un detector universal de clonación; algunas passkeys usan cero.
- No demuestra identidad civil. Demuestra control de una credencial y la verificación local solicitada al autenticador.
- No normaliza mágicamente todos los canales laterales posibles bajo cualquier patrón de carga.
- No soporta autenticadores incapaces de crear credenciales residentes.

---

## Código relevante

- [`auth/auth-api/src/modules/passkeys/`](https://github.com/ElwinErnst/auth-api/tree/main/src/modules/passkeys) — backend NestJS.
- [`sytadel-app/src/features/auth/`](https://github.com/ElwinErnst/sytadel-suite/tree/main/sytadel-app/src/features/auth) — componentes y server actions.
- [`passkeys.service.spec.ts`](https://github.com/ElwinErnst/auth-api/blob/main/src/modules/passkeys/passkeys.service.spec.ts) — invariantes del servicio.
- `auth/auth-api/tests/e2e/passkeys-concurrency.e2e-spec.ts` — concurrencia PostgreSQL real.

Para probarlo localmente:

```bash
docker compose up --build
```

Después abrí `http://localhost:3003/login`, ingresá una vez con contraseña, registrá una passkey desde Settings y volvé a iniciar sesión sin escribir la contraseña.

WebAuthn no es difícil porque la criptografía sea invisible. Es difícil porque el protocolo cruza navegador, autenticador, base de datos, sesiones y UX. La implementación funciona cuando todos esos límites están definidos explícitamente y probados como un único sistema.
