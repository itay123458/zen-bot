import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { STAFF_APPLICATION_CATEGORY_ID, STAFF_APPLICATION_CHANNEL_NAME, STAFF_APPLICATION_GUILD_ID } from '../src/services/staffApplicationService.js';

test('staff application targets only the configured EditIL guild and private category', () => {
  assert.equal(STAFF_APPLICATION_GUILD_ID, '1526671786387705907');
  assert.equal(STAFF_APPLICATION_CATEGORY_ID, '1526687081848504442');
  assert.equal(STAFF_APPLICATION_CHANNEL_NAME, 'staff-applications');
});

test('staff applications use one staff-only inbox and never grant applicants channel access', async () => {
  const service = await readFile(new URL('../src/services/staffApplicationService.js', import.meta.url), 'utf8');
  assert.match(service, /ensureStaffApplicationChannel/);
  assert.match(service, /upsert\(guild\.id, \{ allow: \[\], deny: \[PermissionFlagsBits\.ViewChannel\] \}\)/);
  assert.doesNotMatch(service, /upsert\(member\.id/);
  assert.doesNotMatch(service, /content: `[^`]*\$\{channel\}/);
  assert.doesNotMatch(service, /allowedMentions: \{ users: \[member\.id\]/);
});

test('website staff form requires Discord identity and includes a bot-verification message', async () => {
  const html = await readFile(new URL('../public/index.html', import.meta.url), 'utf8');
  assert.match(html, /id="staffApplicationForm"/);
  assert.match(html, /name="discordId"[^>]+required/);
  assert.match(html, /הבוט ישלח לכם הודעת אימות פרטית/);
  assert.match(html, /id="discordIdGuide"/);
  assert.match(html, /מצב מפתח/);
  assert.match(html, /העתקת מזהה המשתמש/);
  assert.match(html, /אל תשלחו סיסמה או אסימון גישה/);
  assert.match(html, /name="privacyConsent"[^>]+required/);
  assert.doesNotMatch(html, /name="age"/);
});

test('website publishes Hebrew privacy, terms and security notices and removes age collection end to end', async () => {
  const [privacy, terms, security, worker, service, html] = await Promise.all([
    readFile(new URL('../public/privacy-policy.html', import.meta.url), 'utf8'),
    readFile(new URL('../public/terms-of-use.html', import.meta.url), 'utf8'),
    readFile(new URL('../public/security.html', import.meta.url), 'utf8'),
    readFile(new URL('../cloudflare/worker.js', import.meta.url), 'utf8'),
    readFile(new URL('../src/services/staffApplicationService.js', import.meta.url), 'utf8'),
    readFile(new URL('../public/index.html', import.meta.url), 'utf8')
  ]);
  assert.match(privacy, /מדיניות פרטיות/);
  assert.match(privacy, /1127099544560205914/);
  assert.match(terms, /אינה קשורה, מאושרת, ממומנת או מופעלת על־ידי Discord Inc/);
  assert.match(terms, /אין בתנאים אלה כדי לשלול אחריות שלא ניתן לשלול/);
  assert.match(security, /מדיניות אבטחה/);
  assert.match(security, /דיווח בתום לב/);
  assert.match(worker, /\/legal\/security-v1/);
  assert.match(html, /href="\/legal\/security-v1">אבטחה/);
  assert.doesNotMatch(worker, /['"]age['"]/);
  assert.doesNotMatch(service, /application\.age/);
});

test('website editing tutorials are privacy enhanced and click to load', async () => {
  const [html, script, worker] = await Promise.all([
    readFile(new URL('../public/index.html', import.meta.url), 'utf8'),
    readFile(new URL('../public/landing.js', import.meta.url), 'utf8'),
    readFile(new URL('../cloudflare/worker.js', import.meta.url), 'utf8')
  ]);
  assert.match(html, /data-youtube="vjcAwHrAkAM"/);
  assert.match(html, /data-youtube="4uaBMwsMwIY"/);
  assert.match(script, /youtube-nocookie\.com\/embed/);
  assert.match(worker, /frame-src https:\/\/www\.youtube-nocookie\.com/);
});

test('public command grid cannot create horizontal page overflow', async () => {
  const [html, css, script, worker] = await Promise.all([
    readFile(new URL('../public/index.html', import.meta.url), 'utf8'),
    readFile(new URL('../public/premium.css', import.meta.url), 'utf8'),
    readFile(new URL('../public/landing.js', import.meta.url), 'utf8'),
    readFile(new URL('../cloudflare/worker.js', import.meta.url), 'utf8')
  ]);
    assert.match(html, /premium\.css\?v=7\.0\.0/);
    assert.doesNotMatch(html, /class="editor-stage/);
    assert.match(html, /class="creative-ticker"/);
  assert.match(css, /html,body \{[^}]*overflow-x: clip/);
  assert.match(css, /\.commands-section \{[^}]*overflow-x: clip/);
  assert.match(css, /\.commands-section > \.shell \{[^}]*margin-inline: auto/);
  assert.match(css, /\.public-command-grid \{[^}]*repeat\(3,minmax\(0,1fr\)\)/);
  assert.match(css, /\.public-command-grid article \{[^}]*min-width: 0/);
  assert.doesNotMatch(script, /containCommandLayout/);
  assert.match(worker, /const siteResponse[\s\S]*?s-maxage=300/);
  assert.match(worker, /cachePublicResponse/);
  assert.match(worker, /sitemap\.xml/);
  assert.match(worker, /favicon\.ico/);
  assert.match(worker, /\.well-known\/security\.txt/);
  assert.match(worker, /apple-touch-icon\.png/);
  assert.match(worker, /url\.hostname === 'www\.editil\.com'/);
});

test('custom animated background stays lightweight and accessible', async () => {
  const [html, css, script, worker] = await Promise.all([
    readFile(new URL('../public/index.html', import.meta.url), 'utf8'),
    readFile(new URL('../public/premium.css', import.meta.url), 'utf8'),
    readFile(new URL('../public/landing.js', import.meta.url), 'utf8'),
    readFile(new URL('../cloudflare/worker.js', import.meta.url), 'utf8')
  ]);
  assert.match(html, /class="editil-background"/);
  assert.match(css, /--bg: #080a12/);
  assert.match(css, /--surface: #111523/);
  assert.match(css, /--muted: #aeb5d1/);
  assert.match(css, /\.bg-orb\.violet/);
  assert.doesNotMatch(css, /filter: blur\((?:7[0-9]|[89][0-9]|[1-9][0-9]{2,})px\)/);
  assert.match(css, /prefers-reduced-motion: reduce/);
  assert.doesNotMatch(css, /canvas/);
  assert.match(css, /\.page-hidden \.editil-background::before/);
  assert.match(css, /@media \(max-width: 700px\)[\s\S]*?\.editil-background::before,[^}]*animation: none/);
  assert.match(script, /entry\.target\.textContent = '—'/);
  assert.match(script, /const hasLiveStatus = Boolean\(data\.updatedAt\)/);
  assert.match(script, /'המצב מתעדכן'/);
  assert.match(worker, /MAX_STATUS_AGE_MS = 11 \* 60_000/);
  assert.match(html, /class="section shell explore-section" id="explore"/);
  assert.match(html, /data-open-dialog="faqDialog"/);
  assert.match(css, /\.explore-grid \{ display: grid; grid-template-columns: repeat\(5,1fr\)/);
  assert.match(html, /class="bot-stats" hidden/);
  assert.match(script, /\.bot-stats'\)\.hidden = !hasLiveStatus/);
  assert.match(worker, /invites\/6Hu8xpTYqQ\?with_counts=true/);
  assert.match(css, /\[hidden\] \{ display: none !important; \}/);
  assert.match(html, /class="status-chip" hidden/);
  assert.match(script, /\.status-chip'\)\.hidden = !hasLiveStatus/);
});

test('legacy hidden hero and its expensive controller are removed', async () => {
  const [html, script] = await Promise.all([
    readFile(new URL('../public/index.html', import.meta.url), 'utf8'),
    readFile(new URL('../public/landing.js', import.meta.url), 'utf8')
  ]);
  assert.doesNotMatch(html, /editor-stage|site-film|legacy-discord-preview/);
  assert.match(html, /class="reel-ui reel-chat"/);
  assert.match(html, /class="channel-browser/);
  assert.doesNotMatch(script, /film-finished|stagePlay|offsetWidth|setInterval/);
  assert.doesNotMatch(script, /pointermove/);
});

test('premium v6 redesign stays responsive, lightweight and motion accessible', async () => {
  const [html, css, script] = await Promise.all([
    readFile(new URL('../public/index.html', import.meta.url), 'utf8'),
    readFile(new URL('../public/premium.css', import.meta.url), 'utf8'),
    readFile(new URL('../public/landing.js', import.meta.url), 'utf8')
  ]);
  assert.match(html, /premium\.css\?v=7\.0\.0/);
  assert.match(html, /קהילת העורכים/);
  assert.match(html, /הבית של כל יוצר תוכן, עורך וידאו ומעצב/);
  assert.match(html, /class="hero-float/);
  assert.match(css, /scroll-snap-type: x mandatory/);
  assert.match(css, /perspective:\s*1500px/);
  assert.match(css, /prefers-reduced-motion: reduce/);
  assert.doesNotMatch(css, /(^|[},])\s*canvas\s*\{|animation:\s*[^;]*box-shadow/i);
  assert.doesNotMatch(css, /fonts\.googleapis\.com/);
  assert.doesNotMatch(script, /--spot-x/);
  assert.match(script, /sectionObserver/);
  assert.match(script, /aria-current/);
  assert.match(script, /hardwareConcurrency/);
  assert.match(script, /button-ripple/);
});

test('premium hero uses an accessible cinematic monitor carousel', async () => {
  const [html, css, script] = await Promise.all([
    readFile(new URL('../public/index.html', import.meta.url), 'utf8'),
    readFile(new URL('../public/premium.css', import.meta.url), 'utf8'),
    readFile(new URL('../public/landing.js', import.meta.url), 'utf8')
  ]);
  assert.match(html, /premium\.css\?v=7\.0\.0/);
  assert.equal((html.match(/data-reel-slide/g) || []).length, 3);
  assert.equal((html.match(/data-reel-dot=/g) || []).length, 3);
  assert.match(html, /aria-roledescription="carousel"/);
  assert.doesNotMatch(css, /legacy-discord-preview|editor-stage/);
  assert.match(css, /\.hero-reel/);
  assert.match(css, /prefers-reduced-motion: reduce/);
  assert.match(script, /showReelSlide/);
  assert.doesNotMatch(script, /setInterval/);
  assert.match(script, /visibilitychange/);
});

test('public command directory starts compact and can reveal every command', async () => {
  const [html, css, script] = await Promise.all([
    readFile(new URL('../public/index.html', import.meta.url), 'utf8'),
    readFile(new URL('../public/premium.css', import.meta.url), 'utf8'),
    readFile(new URL('../public/landing.js', import.meta.url), 'utf8')
  ]);
  assert.match(html, /id="commandExpand"[^>]*aria-expanded="false"/);
  assert.match(script, /commandsExpanded = false/);
  assert.match(script, /compact && matches > 6/);
  assert.match(script, /commandExpand\.addEventListener\('click'/);
  assert.match(css, /\.section \{[^}]*padding-block: 120px/);
  assert.match(html, /<dialog class="staff-application-dialog" id="staffApplicationDialog">/);
  assert.match(script, /staffDialog\.showModal\(\)/);
  assert.equal((html.match(/<details class="compact-panel">/g) || []).length, 0);
  assert.equal((html.match(/<dialog class="content-dialog/g) || []).length, 4);
  assert.match(script, /\$\$\('\[data-open-dialog\]'\)/);
  assert.doesNotMatch(html, /class="software shell/);
  assert.doesNotMatch(html, /class="cta shell/);
});

test('worker protects bot polling and rate limits public submissions', async () => {
  const worker = await readFile(new URL('../cloudflare/worker.js', import.meta.url), 'utf8');
  assert.match(worker, /HEARTBEAT_SECRET/);
  assert.match(worker, /staffapp:rate:/);
  assert.match(worker, /staffapp:user:/);
  assert.match(worker, /expirationTtl: 3600/);
  assert.match(worker, /frame-ancestors 'none'/);
  assert.match(worker, /delete saved\[field\]/);
  assert.match(worker, /STAFF_SETTINGS_KEY/);
  assert.match(worker, /settings\?\.open !== true/);
  assert.match(worker, /staff-applications\/availability/);
});

test('owner can open, close, or inspect website staff applications', async () => {
  const command = (await import('../src/commands/owner/staffapplications.js')).default;
  const json = command.data.toJSON();
  assert.equal(json.name, 'staffapplications');
  assert.deepEqual(json.options.map(option => option.name), ['open', 'close', 'status']);
  assert.match(command.execute.toString(), /interaction\.user\.id !== BOT_OWNER_USER_ID/);
});
