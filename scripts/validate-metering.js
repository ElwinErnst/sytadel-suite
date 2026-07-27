async function parseJson(response) {
  const text = await response.text();
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

async function expectOk(response, label) {
  const body = await parseJson(response);
  if (!response.ok) {
    throw new Error(
      `${label} failed ${response.status} ${JSON.stringify(body, null, 2)}`,
    );
  }

  return body;
}

async function run() {
  const baseAuth = process.env.AUTH_BASE_URL ?? 'http://localhost:3002/api';
  const baseBilling =
    process.env.BILLING_BASE_URL ?? 'http://localhost:3020/api';
  const baseZt = process.env.ZT_BASE_URL ?? 'http://localhost:3010';
  const seedEmail = process.env.SMOKE_EMAIL ?? 'admin@test.com';
  const seedPassword = process.env.SMOKE_PASSWORD ?? '123456';
  const seedTenantSlug = process.env.SMOKE_TENANT_SLUG ?? 'sentinel-labs';
  const runId = Date.now();
  const tenantSlug = `metering-${runId}`;
  const tenantName = `Metering ${runId}`;

  const seedPair = await expectOk(
    await fetch(`${baseAuth}/auth/login`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        email: seedEmail,
        password: seedPassword,
        tenantSlug: seedTenantSlug,
      }),
    }),
    'seed login',
  );

  await expectOk(
    await fetch(`${baseAuth}/tenants`, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${seedPair.accessToken}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        name: tenantName,
        slug: tenantSlug,
        apiAddons: ['AUTH_API', 'VAULT_API', 'ZERO_TRUST_API'],
        billingBypass: true,
      }),
    }),
    'tenant creation',
  );

  const ownerPair = await expectOk(
    await fetch(`${baseAuth}/auth/login`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        email: seedEmail,
        password: seedPassword,
        tenantSlug,
      }),
    }),
    'tenant login',
  );
  const ownerToken = ownerPair.accessToken;

  const me = await expectOk(
    await fetch(`${baseAuth}/auth/me`, {
      headers: { authorization: `Bearer ${ownerToken}` },
    }),
    'auth me',
  );
  const tenantId = me.tenant.id;

  const checkoutBody = await expectOk(
    await fetch(`${baseBilling}/billing/checkout-sessions`, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${ownerToken}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        industry: 'GENERAL',
        tier: 'BUSINESS',
        billingCycle: 'monthly',
        seats: 1,
        addOns: ['AUTH_API', 'VAULT_API', 'ZERO_TRUST_API'],
      }),
    }),
    'checkout',
  );

  if (checkoutBody.provider === 'mock') {
    await expectOk(await fetch(checkoutBody.checkoutUrl), 'activate');
  }

  const apps = await expectOk(
    await fetch(`${baseAuth}/tenants/${tenantId}/client-apps`, {
      headers: { authorization: `Bearer ${ownerToken}` },
    }),
    'list apps',
  );

  let app = Array.isArray(apps) ? apps[0] : null;
  if (!app) {
    app = await expectOk(
      await fetch(`${baseAuth}/tenants/${tenantId}/client-apps`, {
        method: 'POST',
        headers: {
          authorization: `Bearer ${ownerToken}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          name: 'Metering App',
          slug: `metering-${runId}`,
        }),
      }),
      'create app',
    );
  }

  const serviceAccount = await expectOk(
    await fetch(
      `${baseAuth}/tenants/${tenantId}/client-apps/${app.id}/service-accounts`,
      {
        method: 'POST',
        headers: {
          authorization: `Bearer ${ownerToken}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          name: `Metering SA ${runId}`,
        }),
      },
    ),
    'create service account',
  );

  const issued = await expectOk(
    await fetch(`${baseAuth}/integrations/service-account-token`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        tenantSlug,
        clientAppId: app.id,
        serviceAccountId: serviceAccount.serviceAccount.id,
        clientSecret: serviceAccount.clientSecret,
      }),
    }),
    'issue token',
  );
  const apiToken = issued.accessToken;

  await expectOk(
    await fetch(`${baseZt}/api/zt/status`, {
      headers: { authorization: `Bearer ${apiToken}` },
    }),
    'zt status',
  );

  await expectOk(
    await fetch(`${baseZt}/vault/vaults`, {
      headers: { authorization: `Bearer ${apiToken}` },
    }),
    'vault list',
  );

  const overview = await expectOk(
    await fetch(`${baseBilling}/billing/subscription`, {
      headers: { authorization: `Bearer ${ownerToken}` },
    }),
    'overview',
  );

  console.log(
    JSON.stringify(
      {
        tenantSlug,
        checkoutProvider: checkoutBody.provider,
        subscriptionStatus: overview.subscription?.status,
        addOns: overview.subscription?.apiAddons,
        authUsage: overview.usage?.totals?.AUTH_API ?? null,
        vaultUsage: overview.usage?.totals?.VAULT_API ?? null,
        zeroTrustUsage: overview.usage?.totals?.ZERO_TRUST_API ?? null,
        recentEvents: overview.usage?.recentEvents?.slice?.(0, 5) ?? [],
      },
      null,
      2,
    ),
  );
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
