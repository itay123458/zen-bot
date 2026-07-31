import test from 'node:test';
import assert from 'node:assert/strict';
import stealSticker, { parseDiscordMessageLink } from '../src/commands/moderation/stealsticker.js';

test('/stealsticker is a guild-only Hebrew staff command with safe inputs', () => {
  const data = stealSticker.data.toJSON();
  assert.equal(data.name, 'stealsticker');
  assert.equal(data.dm_permission, false);
  assert.match(data.description, /[\u0590-\u05ff]/);
  assert.deepEqual(data.options.map(option => option.name), ['message_link', 'name', 'emoji', 'description']);
  assert.equal(data.options[0].required, true);
  assert.equal(data.options.find(option => option.name === 'name').max_length, 30);
});

test('message link parser accepts Discord links and rejects unrelated URLs', () => {
  assert.deepEqual(
    parseDiscordMessageLink('https://discord.com/channels/1526671786387705907/1526672392313639072/1532139193277481041'),
    {
      guildId: '1526671786387705907',
      channelId: '1526672392313639072',
      messageId: '1532139193277481041',
    },
  );
  assert.equal(parseDiscordMessageLink('https://example.com/channels/1/2/3'), null);
  assert.equal(parseDiscordMessageLink('not a link'), null);
});
