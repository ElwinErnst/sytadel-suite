'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const NAV_ITEMS = [
  { href: '/app', label: 'Resumen' },
  { href: '/app/access', label: 'Equipo y acceso' },
  { href: '/app/vaults', label: 'Vaults' },
  { href: '/app/documents', label: 'Documentos' },
  { href: '/app/audit', label: 'Auditoría' },
  { href: '/app/billing', label: 'Facturación' },
  { href: '/app/settings', label: 'Configuración' },
];

const ROADMAP_ITEMS = [
  { label: 'Zero Trust' },
  { label: 'Notary' },
];

function isActive(pathname: string, href: string) {
  if (href === '/app') {
    return pathname === '/app';
  }

  return pathname === href || pathname.startsWith(`${href}/`);
}

export function SidebarNav() {
  const pathname = usePathname();

  return (
    <div className="sidebar-section">
      <span className="sidebar-label">Producto</span>
      {NAV_ITEMS.map((item) => (
        <Link
          key={item.href}
          className={isActive(pathname, item.href) ? 'nav-link nav-link-active' : 'nav-link'}
          href={item.href}
        >
          <span>{item.label}</span>
        </Link>
      ))}

      <div className="sidebar-section sidebar-section-roadmap">
        <span className="sidebar-label">Roadmap</span>
        {ROADMAP_ITEMS.map((item) => (
          <div key={item.label} className="nav-link-muted">
            <span>{item.label}</span>
            <span className="badge">Soon</span>
          </div>
        ))}
      </div>
    </div>
  );
}
