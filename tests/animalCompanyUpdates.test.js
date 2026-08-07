import test from 'node:test';
import assert from 'node:assert/strict';
import command from '../src/commands/owner/ac.js';
import { categorizeReleaseNotes, fetchAnimalCompanyUpdates, releaseNoteLines } from '../src/services/animalCompanyUpdateService.js';

test('/ac exposes an owner-oriented mods command group hidden by default', () => {
  const json = command.data.toJSON();
  assert.equal(json.name, 'ac');
  assert.equal(json.default_member_permissions, '0');
  assert.deepEqual(json.options[0].options.map(option => option.name), ['check', 'status', 'post']);
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
