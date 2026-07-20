import test from 'node:test';
import assert from 'node:assert/strict';
import sayCommand from '../src/commands/owner/say.js';
import { OWNER_INBOX_USER_ID } from '../src/services/ownerInboxService.js';

test('/say is guild-only and accepts optional text plus an optional video', () => {
  const data = sayCommand.data.toJSON();
  assert.equal(data.name, 'say');
  assert.equal(data.dm_permission, false);
  assert.equal(data.options.length, 2);
  assert.equal(data.options[0].name, 'message');
  assert.equal(data.options[0].required, false);
  assert.equal(data.options[0].max_length, 2000);
  assert.equal(data.options[1].name, 'video');
  assert.equal(data.options[1].required, false);
});

test('/say posts only as the bot with every mention type disabled', async () => {
  const sent = [];
  const replies = [];
  const interaction = {
    user: { id: OWNER_INBOX_USER_ID },
    guildId: 'guild-1',
    channelId: 'channel-1',
    channel: {
      isTextBased: () => true,
      send: async payload => {
        sent.push(payload);
        return { id: 'message-1', url: 'https://discord.com/channels/guild-1/channel-1/message-1' };
      },
    },
    options: {
      getString: () => 'hello @everyone <@123>',
      getAttachment: () => null,
    },
    deferReply: async payload => replies.push(['defer', payload]),
    editReply: async payload => replies.push(['edit', payload]),
  };

  await sayCommand.execute(interaction);

  assert.equal(sent.length, 1);
  assert.equal(sent[0].content, 'hello @everyone <@123>');
  assert.deepEqual(sent[0].files, []);
  assert.deepEqual(sent[0].allowedMentions, { parse: [], users: [], roles: [] });
  assert.match(replies.at(-1)[1], /message-1/);
});

test('/say can upload a video as the bot without requiring text', async () => {
  let sent;
  const interaction = {
    user: { id: OWNER_INBOX_USER_ID },
    guildId: 'guild-1',
    channelId: 'channel-1',
    channel: {
      isTextBased: () => true,
      send: async payload => {
        sent = payload;
        return { id: 'message-2', url: 'https://discord.com/channels/guild-1/channel-1/message-2' };
      },
    },
    options: {
      getString: () => null,
      getAttachment: () => ({
        id: 'attachment-1',
        url: 'data:video/mp4;base64,AAECAw==',
        name: 'edit.mp4',
        description: 'EditIL video',
      }),
    },
    deferReply: async () => {},
    editReply: async () => {},
  };

  await sayCommand.execute(interaction);

  assert.equal(sent.content, undefined);
  assert.equal(Buffer.isBuffer(sent.files[0].attachment), true);
  assert.deepEqual([...sent.files[0].attachment], [0, 1, 2, 3]);
  assert.equal(sent.files[0].name, 'edit.mp4');
  assert.equal(sent.files[0].description, 'EditIL video');
  assert.deepEqual(sent.allowedMentions, { parse: [], users: [], roles: [] });
});

test('/say rejects an empty request', async () => {
  let reply;
  await sayCommand.execute({
    user: { id: OWNER_INBOX_USER_ID },
    channel: { isTextBased: () => true },
    options: {
      getString: () => null,
      getAttachment: () => null,
    },
    reply: async payload => { reply = payload; },
  });

  assert.equal(reply.flags, 64);
  assert.match(reply.content, /טקסט, סרטון/);
});

test('/say explains a Discord upload timeout in Hebrew', async () => {
  let reply;
  const timeout = new Error('This operation was aborted');
  timeout.name = 'AbortError';
  await sayCommand.execute({
    user: { id: OWNER_INBOX_USER_ID },
    guildId: 'guild-1',
    channelId: 'channel-1',
    channel: {
      isTextBased: () => true,
      send: async () => { throw timeout; },
    },
    options: {
      getString: () => 'hello',
      getAttachment: () => null,
    },
    deferReply: async () => {},
    editReply: async payload => { reply = payload; },
  });

  assert.match(reply, /ארכה יותר מדי זמן/);
});

test('/say rejects users other than the configured owner', async () => {
  let sent = false;
  let reply;
  await sayCommand.execute({
    user: { id: 'not-owner' },
    channel: { isTextBased: () => true, send: async () => { sent = true; } },
    reply: async payload => { reply = payload; },
  });

  assert.equal(sent, false);
  assert.equal(reply.flags, 64);
});
