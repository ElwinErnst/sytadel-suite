const site = import.meta.env.SITE ?? 'https://sytadel-labs.com';

const pages = ['/', '/es/', '/en/', '/pt/'];

export function GET() {
  const body = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${pages
  .map((path) => {
    const url = new URL(path, site).toString();
    return `  <url>
    <loc>${url}</loc>
  </url>`;
  })
  .join('\n')}
</urlset>`;

  return new Response(body, {
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
    },
  });
}
