export const env = {
  authApiUrl: process.env.AUTH_API_URL ?? 'http://localhost:3002/api',
  billingApiUrl: process.env.BILLING_API_URL ?? 'http://localhost:3020/api',
  ztApiUrl: process.env.ZT_API_URL ?? 'http://localhost:3010',
  vaultApiUrl: process.env.VAULT_API_URL ?? 'http://localhost:3000',
  nodeEnv: process.env.NODE_ENV ?? 'development',
};
