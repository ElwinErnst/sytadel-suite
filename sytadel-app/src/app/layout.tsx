import type { Metadata } from 'next';
import './globals.css';

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
