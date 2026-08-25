import type { Locale } from './content';

export type SitePage = 'home';

type NavItem = {
  label: string;
  href: string;
};

const navLabels: Record<Locale, NavItem[]> = {
  es: [
    { label: 'Producto', href: '#producto' },
    { label: 'APIs', href: '#apis' },
    { label: 'Módulos', href: '#modulos' },
    { label: 'Seguridad', href: '#seguridad' },
    { label: 'Contacto', href: '#contacto' },
  ],
  en: [
    { label: 'Product', href: '#product' },
    { label: 'APIs', href: '#apis' },
    { label: 'Modules', href: '#modules' },
    { label: 'Security', href: '#security' },
    { label: 'Contact', href: '#contact' },
  ],
  pt: [
    { label: 'Produto', href: '#produto' },
    { label: 'APIs', href: '#apis' },
    { label: 'Módulos', href: '#modulos' },
    { label: 'Segurança', href: '#seguranca' },
    { label: 'Contato', href: '#contato' },
  ],
};

export function getPagePath(lang: Locale, page: SitePage): string {
  void page;
  return `/${lang}/`;
}

export function getNav(lang: Locale) {
  return navLabels[lang];
}
