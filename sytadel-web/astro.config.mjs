// @ts-check
import { defineConfig } from 'astro/config';

// https://astro.build/config
export default defineConfig({
  site: process.env.SITE_URL ?? 'https://sytadel-labs.com',

  // Content-Security-Policy for this (static) marketing site. Astro hashes its
  // inline scripts/styles at build time and emits a per-page CSP <meta> — the
  // static-friendly equivalent of the nonce-based CSP on the app frontend.
  // script-src/style-src (with the hashes) are added by Astro automatically.
  security: {
    csp: {
      directives: [
        "default-src 'self'",
        "img-src 'self' data:",
        "font-src 'self'",
        "connect-src 'self'",
        "frame-ancestors 'none'",
        "base-uri 'self'",
        "form-action 'self'",
        "object-src 'none'",
      ],
    },
  },
});
