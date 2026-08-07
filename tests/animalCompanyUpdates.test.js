import test from 'node:test';
import assert from 'node:assert/strict';
import command from '../src/commands/owner/ac.js';
import { ANIMAL_COMPANY_CHANNEL_ID, ANIMAL_COMPANY_GUILD_ID, buildAnimalCompanyEmbed, categorizeReleaseNotes, extractAnimalCompanyVersion, fetchAnimalCompanyUpdates, releaseNoteLines } from '../src/services/animalCompanyUpdateService.js';

test('/ac exposes an owner-oriented mods command group hidden by default', () => {
  const json = command.data.toJSON();
  assert.equal(json.name, 'ac');
  assert.equal(json.default_member_permissions, '0');
  assert.deepEqual(json.options[0].options.map(option => option.name), ['check', 'status', 'post']);
});

test('tracker targets the configured private channel', () => {
  assert.equal(ANIMAL_COMPANY_GUILD_ID, '1502383010656288949');
  assert.equal(ANIMAL_COMPANY_CHANNEL_ID, '1502388916895088740');
});

test('release notes are cleaned and categorized', () => {
  const content = '[b]Update[/b]\n• Added a new laser item\n• Fixed a crash\n• New forest map';
  assert.deepEqual(releaseNoteLines(content), ['Update', 'Added a new laser item', 'Fixed a crash', 'New forest map']);
  const categories = categorizeReleaseNotes(content);
  assert.deepEqual(categories['New items'], ['Added a new laser item']);
  assert.deepEqual(categories.Fixes, ['Fixed a crash']);
  assert.deepEqual(categories['Maps & areas'], ['New forest map']);
});

test('Steam updates are normalized oldest first', async () => {
  const fakeFetch = async () => ({ ok: true, json: async () => ({ appnews: { newsitems: [{ gid: '2', title: 'B', date: 2 }, { gid: '1', title: 'A', date: 1 }] } }) });
  assert.deepEqual((await fetchAnimalCompanyUpdates(fakeFetch)).map(item => item.gid), ['1', '2']);
});

test('developer build embed matches the compact AMB tracker card', () => {
  const item = { title: 'AC 1.86.0.3325', contents: '', date: 1786104300, url: 'https://example.com/update' };
  const checkedAt = new Date('2026-08-07T09:05:05.000Z');
  assert.equal(extractAnimalCompanyVersion(item), '1.86.0.3325');
  const json = buildAnimalCompanyEmbed(item, checkedAt).toJSON();
  assert.equal(json.color, 0xed1c24);
  assert.equal(json.author.name, 'AMB Tracker X');
  assert.equal(json.title, 'New Developer Build');
  assert.equal(json.fields[0].name, '🟢 Updated Version:');
  assert.equal(json.fields[0].value, '```\n1.86.0.3325\n```');
  assert.match(json.fields[1].value, /^\(<t:\d+:R>\) <t:\d+:F>$/);
  assert.equal(json.footer.text, 'Checked at 2026-08-07T09:05:05.000Z');
});
