import type { Metadata } from 'next';
import './globals.css';

// Render every route dynamically so the CSP middleware's per-request nonce is
// applied to the framework's inline scripts. Static pages are baked at build
// time without a nonce, which the strict (strict-dynamic) CSP would block.
export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Sytadel Console',
  description: 'Dashboard operativo para tenants, acceso y documentacion segura',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
