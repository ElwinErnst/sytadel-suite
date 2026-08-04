import { AppShell } from '@/components/app-shell';
import { requireSession } from '@/lib/server/session';

export const dynamic = 'force-dynamic';

export default async function ProtectedLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const session = await requireSession();

  return (
    <AppShell session={session}>
      {children}
    </AppShell>
  );
}
