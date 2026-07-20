import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

const publicDir = path.resolve('public');
const pages = [
  ['index.html', 'he'],
  ['privacy-policy.html', 'he'],
  ['terms-of-use.html', 'he'],
  ['security.html', 'he'],
  ['accessibility.html', 'he'],
  ['login.html', 'en'],
  ['dashboard.html', 'en'],
];

const readPage = filename => readFile(path.join(publicDir, filename), 'utf8');

test('every website page exposes essential accessibility metadata and navigation', async () => {
  for (const [filename, language] of pages) {
    const html = await readPage(filename);
    assert.match(html, new RegExp(`<html[^>]+lang=["']${language}["']`), `${filename}: document language`);
    assert.doesNotMatch(html, /(?:user-scalable\s*=\s*no|maximum-scale\s*=\s*1)/i, `${filename}: zoom must remain available`);
    assert.match(html, /<main[^>]+(?:id=["'][^"']+["'][^>]*tabindex=["']-1["']|tabindex=["']-1["'][^>]*id=["'][^"']+["'])/i, `${filename}: focusable primary main landmark`);
    assert.match(html, /class=["'][^"']*skip-link[^"']*["'][^>]+href=["']#[^"']+["']/i, `${filename}: skip link`);
    assert.match(html, /href=["']\/accessibility\.html["']/i, `${filename}: accessibility statement link`);
  }
});

test('landing dialogs and tab widgets have programmatic names and relationships', async () => {
  const html = await readPage('index.html');
  const dialogs = [...html.matchAll(/<dialog\b([^>]*)>/gi)];
  assert.ok(dialogs.length >= 5, 'expected landing dialogs');
  for (const [, attributes] of dialogs) {
    if (/id=["']staffApplicationDialog["']/i.test(attributes)) continue;
    const label = attributes.match(/aria-labelledby=["']([^"']+)["']/i)?.[1];
    assert.ok(label, 'every dialog has aria-labelledby');
    assert.match(html, new RegExp(`id=["']${label}["']`), `dialog label ${label} exists`);
  }
  assert.match(await readFile(path.join(publicDir, 'landing.js'), 'utf8'), /staffDialog\.setAttribute\(['"]aria-labelledby['"],\s*['"]staffApplicationTitle['"]\)/);

  for (const match of html.matchAll(/role=["']tab["'][^>]*aria-controls=["']([^"']+)["']/gi)) {
    assert.match(html, new RegExp(`id=["']${match[1]}["'][^>]*role=["']tabpanel["']`), `tabpanel ${match[1]} exists`);
  }
});

test('dashboard tabs expose selected state and matching panels', async () => {
  const html = await readPage('dashboard.html');
  assert.match(html, /role=["']tablist["']/i);
  assert.match(html, /role=["']tab["'][^>]+aria-selected=["']true["']/i);
  for (const match of html.matchAll(/aria-controls=["'](tab-[^"']+)["']/gi)) {
    assert.match(html, new RegExp(`id=["']${match[1]}["'][^>]*role=["']tabpanel["']`), `dashboard panel ${match[1]} exists`);
  }
});

test('forms and dynamic feedback are exposed to assistive technology', async () => {
  const login = await readPage('login.html');
  const landing = await readPage('index.html');
  const dashboard = await readPage('dashboard.html');
  assert.match(login, /<label\s+for=["']email["']/i);
  assert.match(login, /<label\s+for=["']pw["']/i);
  assert.match(login, /id=["']err["'][^>]+role=["']alert["']/i);
  assert.match(landing, /id=["']staffApplicationResult["'][^>]+role=["']status["']/i);
  assert.match(landing, /id=["']commandFilterStatus["'][^>]+role=["']status["']/i);
  assert.match(dashboard, /id=["']dashboardStatus["'][^>]+role=["']status["']/i);
});

test('accessibility statement documents standard, limitations and contact route', async () => {
  const html = await readPage('accessibility.html');
  assert.match(html, /ת״י 5568/);
  assert.match(html, /WCAG 2\.0/);
  assert.match(html, /רמה AA/);
  assert.match(html, /צדדים שלישיים/);
  assert.match(html, /אין משרד או מקום פיזי לקבלת קהל/);
  assert.match(html, /1127099544560205914/);
});
