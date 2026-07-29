import test from 'node:test';
import assert from 'node:assert/strict';
import { moderationCommand, parseModerationDuration } from '../src/commands/moderation/factory.js';

const commandNames = [
  'ban', 'unban', 'softban', 'kick', 'timeout', 'untimeout',
  'warn', 'warnings', 'clearwarnings', 'note', 'notes', 'clearnotes',
  'clear', 'lock', 'unlock', 'hide', 'unhide', 'slowmode', 'nick', 'voicekick',
];

test('the complete moderation command set builds as unique guild commands', () => {
  const commands = commandNames.map(name => moderationCommand(name).data.toJSON());

  assert.equal(new Set(commands.map(command => command.name)).size, commandNames.length);
  for (const command of commands) {
    assert.equal(command.dm_permission, false);
    assert.match(command.description, /[\u0590-\u05ff]/);
  }
});

test('/clear exposes useful message filters', () => {
  const data = moderationCommand('clear').data.toJSON();
  assert.deepEqual(data.options.map(option => option.name), ['amount', 'member', 'type', 'contains']);
  assert.deepEqual(
    data.options.find(option => option.name === 'type').choices.map(choice => choice.value),
    ['all', 'bots', 'links', 'attachments'],
  );
});

test('new moderation commands expose the expected required inputs', () => {
  const note = moderationCommand('note').data.toJSON();
  assert.equal(note.options.find(option => option.name === 'reason').required, true);

  const softban = moderationCommand('softban').data.toJSON();
  assert.ok(softban.options.some(option => option.name === 'delete_messages'));

  const channelCommands = ['hide', 'unhide'];
  for (const name of channelCommands) {
    assert.ok(moderationCommand(name).data.toJSON().options.some(option => option.name === 'channel'));
  }
});

test('moderation duration parser accepts combined values and enforces Discord limit', () => {
  assert.equal(parseModerationDuration('1h30m'), 5_400_000);
  assert.equal(parseModerationDuration('2w'), 1_209_600_000);
  assert.equal(parseModerationDuration('29d'), null);
  assert.equal(parseModerationDuration('later'), null);
});
