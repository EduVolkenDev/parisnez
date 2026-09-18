import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const root = new URL('../', import.meta.url);
const catalog = readFileSync(new URL('assets/js/supabase-catalog.js', root), 'utf8');
const siteId = catalog.match(/const SITE_ID = "([^"]+)"/)?.[1];
assert.ok(siteId, 'Use the same workspace as the existing public catalogue');
const expectedReturn = `/dashboard/propertyflow/?site=${siteId}`;

for (const file of ['index.html', 'about.html', 'contact.html', 'privacy.html', 'terms.html']) {
  const html = readFileSync(new URL(file, root), 'utf8');
  assert.equal((html.match(/href="\.\/assets\/css\/dashboard-access\.css"/g) || []).length, 1, `${file}: shared styles`);
  const links = [...html.matchAll(/<a\s+class="dashboard-access[^\"]*"[^>]*href="([^"]+)"[^>]*aria-label="([^"]+)"[^>]*>([\s\S]*?)<\/a>/g)];
  assert.equal(links.length, 2, `${file}: header and footer access`);
  for (const [, href, label, body] of links) {
    const target = new URL(href);
    assert.equal(target.origin, 'https://volynx.world', `${file}: trusted login origin`);
    assert.equal(target.pathname, '/login/', `${file}: existing login flow`);
    assert.equal(target.searchParams.get('return'), expectedReturn, `${file}: exact Johnny workspace`);
    assert.equal(target.searchParams.size, 1, `${file}: no credentials in URL`);
    assert.match(label, /painel de imóveis na VOLYNX/i);
    assert.match(body, /aria-hidden="true"/);
    assert.match(body, /<span>(Painel|Área do corretor)<\/span>/);
  }
  console.log(`PASS ${file}: accessible links to the correct workspace`);
}
const css = readFileSync(new URL('assets/css/dashboard-access.css', root), 'utf8');
assert.match(css, /:focus-visible/);
assert.match(css, /min-height: 44px/);
assert.match(css, /flex-wrap: wrap/);
console.log('PASS shared focus, touch targets and responsive wrapping');
