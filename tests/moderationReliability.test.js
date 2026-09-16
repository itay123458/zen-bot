import test from 'node:test';
import assert from 'node:assert/strict';
import { ChannelType, Collection, MessageFlags } from 'discord.js';
import { moderationCommand } from '../src/commands/moderation/factory.js';
import { BOT_OWNER_USER_ID } from '../src/config/owner.js';

for (const [actorId, targetPosition, allowed] of [
  [BOT_OWNER_USER_ID, 5, true], ['moderator', 5, false], [BOT_OWNER_USER_ID, 10, false],
]) {
  test(`moderation hierarchy: actor ${actorId}, target position ${targetPosition}, allowed ${allowed}`, async () => {
    const f = fixture('kick');
    let kicked = false;
    const target = { id: 'target', roles: { highest: { position: targetPosition } },
      kickable: true, kick: async () => { kicked = true; } };
    f.client.user = { id: 'bot' };
    f.interaction.user.id = actorId;
    f.interaction.member.roles = { highest: { position: 2 } };
    f.interaction.guild.ownerId = 'server-owner';
    f.interaction.guild.members.me.roles = { highest: { position: 10 } };
    f.interaction.guild.members.fetch = async () => target;
    f.interaction.options.getUser = () => ({ id: 'target', send: async () => {} });
    await moderationCommand('kick').execute(f.interaction, f.client);
    assert.equal(kicked, allowed);
  });
}

function fixture(name, messages = []) {
  const records = new Map();
  const calls = [];
  const channel = {
    id: 'channel', type: ChannelType.GuildText,
    permissionOverwrites: { cache: new Map(), edit: async () => { calls.push('overwrite'); } },
    messages: { fetch: async () => { calls.push('fetch'); return new Collection(messages.map(m => [m.id, m])); } },
    bulkDelete: async selected => { calls.push('delete'); return { size: selected.length }; },
  };
  const client = { db: {
    get: async (key, fallback) => { calls.push('db'); return records.get(key) ?? fallback; },
    set: async (key, value) => records.set(key, value),
    delete: async key => records.delete(key),
  } };
  const interaction = {
    id: 'interaction', commandName: name, guildId: 'guild', channelId: channel.id, client, channel,
    user: { id: 'moderator', tag: 'Moderator' }, inGuild: () => true,
    member: { permissions: { has: () => true } },
    guild: { id: 'guild', roles: { everyone: { id: 'everyone' } }, members: { me: { permissions: { has: () => true } } } },
    options: { getString: () => null, getUser: () => null, getChannel: () => null, getInteger: () => 100 },
    deferReply: async payload => { calls.push('defer'); assert.equal(payload.flags, MessageFlags.Ephemeral); interaction.deferred = true; },
    reply: async () => { throw new Error('Must edit deferred reply'); },
    editReply: async payload => { interaction.payload = payload; interaction.replied = true; },
    followUp: async payload => { interaction.payload = payload; },
  };
  return { interaction, client, channel, records, calls };
}

test('moderation acknowledges before database or Discord work', async () => {
  const f = fixture('clear');
  await moderationCommand('clear').execute(f.interaction, f.client);
  assert.equal(f.calls[0], 'defer');
  assert.ok(f.interaction.payload);
});

test('failed acknowledgement prevents moderation side effects', async () => {
  const f = fixture('lock');
  f.interaction.deferReply = async () => { throw Object.assign(new Error('expired'), { code: 10062 }); };
  await moderationCommand('lock').execute(f.interaction, f.client);
  assert.deepEqual(f.calls, []);
  assert.equal(f.records.size, 0);
});

test('access denial completes the deferred reply without editing the channel', async () => {
  const f = fixture('lock');
  f.interaction.member.permissions.has = () => false;
  await moderationCommand('lock').execute(f.interaction, f.client);
  assert.ok(f.interaction.payload);
  assert.ok(!f.calls.includes('overwrite'));
  assert.equal(f.records.size, 0);
});

test('failed unlock keeps the original permission available for retry', async () => {
  const f = fixture('unlock');
  const key = 'community:guild:lock:channel';
  f.records.set(key, { previous: true });
  f.channel.permissionOverwrites.edit = async () => { throw new Error('Missing permissions'); };
  await moderationCommand('unlock').execute(f.interaction, f.client);
  assert.deepEqual(f.records.get(key), { previous: true });
});

for (const name of ['lock', 'hide']) {
  test(`${name} failure clears saved state and permits retry and restore`, async () => {
    const f = fixture(name);
    const stateKey = `community:guild:${name === 'lock' ? 'lock' : 'visibility'}:channel`;
    f.channel.permissionOverwrites.edit = async () => { throw new Error('Missing permissions'); };
    await moderationCommand(name).execute(f.interaction, f.client);
    assert.equal(f.records.has(stateKey), false);
    let permission;
    f.channel.permissionOverwrites.edit = async (_, value) => { permission = value; };
    await moderationCommand(name).execute(f.interaction, f.client);
    assert.equal(f.records.get(stateKey).previous, null);
    assert.deepEqual(permission, { [name === 'lock' ? 'SendMessages' : 'ViewChannel']: false });
    await moderationCommand(name === 'lock' ? 'unlock' : 'unhide').execute(f.interaction, f.client);
    assert.equal(f.records.has(stateKey), false);
    assert.deepEqual(permission, { [name === 'lock' ? 'SendMessages' : 'ViewChannel']: null });
  });
}

const message = (id, days, pinned = false) => ({ id, pinned, createdTimestamp: Date.now() - days * 86_400_000 });
test('clear explains old messages without attempting an empty bulk deletion', async () => {
  const f = fixture('clear', [message('old', 15)]);
  await moderationCommand('clear').execute(f.interaction, f.client);
  assert.ok(!f.calls.includes('delete'));
  const description = f.interaction.payload.embeds[0].data.description;
  assert.match(description, /14/);
  assert.match(description, /100/);
  assert.match(description, /\*\*0\*\*/);
});
test('clear deletes recent unpinned messages only and reports skipped old messages', async () => {
  const f = fixture('clear', [message('old', 15), message('recent', 1), message('pinned', 1, true)]);
  let selected;
  f.channel.bulkDelete = async value => { selected = value; return { size: value.length }; };
  await moderationCommand('clear').execute(f.interaction, f.client);
  assert.deepEqual(selected.map(m => m.id), ['recent']);
  assert.match(f.interaction.payload.embeds[0].data.description, /14/);
});
