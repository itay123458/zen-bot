import test from 'node:test';
import assert from 'node:assert/strict';
import { Collection, PermissionsBitField, PermissionFlagsBits, SlashCommandBuilder } from 'discord.js';
import { BOT_OWNER_USER_ID } from '../src/config/owner.js';
import { requireAccess, AccessLevel } from '../src/modules/community/permissions.js';
import { registerCommands } from '../src/handlers/commandLoader.js';
import interactionCreate from '../src/events/interactionCreate.js';
import sticky from '../src/commands/moderation/sticky.js';
import { ticketCommand } from '../src/commands/tickets/factory.js';
import { normalizeTicket } from '../src/services/ticketSystemService.js';

const interaction = (id = BOT_OWNER_USER_ID, permissions = 0n) => ({
  user: { id }, guildId: 'test-guild', channelId: 'channel', commandName: 'restricted',
  inGuild: () => true, isChatInputCommand: () => true,
  member: { id, permissions: new PermissionsBitField(permissions), roles: { cache: new Collection() } },
  memberPermissions: new PermissionsBitField(permissions),
  reply: async () => {},
});

test('owner can run commands disabled in guild settings', async () => {
  const client = { db: { get: async () => ({ commandSettings: { restricted: { enabled: false } } }) } };
  assert.equal(await requireAccess(interaction(), client, AccessLevel.OWNER), true);
  assert.equal(await requireAccess(interaction('member'), client, AccessLevel.EVERYONE), false);
});

test('registration exposes restricted commands to the owner without discarding runtime requirements', async () => {
  const data = new SlashCommandBuilder().setName('restricted').setDescription('Restricted command')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild);
  let registered;
  await registerCommands({ commands: new Collection([['restricted', { data }]]),
    application: { commands: { set: async commands => { registered = commands; } } } });
  assert.equal(registered[0].default_member_permissions, null);
  assert.equal(data.toJSON().default_member_permissions, String(PermissionFlagsBits.ManageGuild));
});

test('router enforces original Discord permissions for non-owners in every guild', async () => {
  let executions = 0;
  const command = { data: new SlashCommandBuilder().setName('restricted').setDescription('Restricted command')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild), execute: async () => { executions++; } };
  const client = { commands: new Collection([['restricted', command]]) };
  await interactionCreate.execute(interaction('member'), client);
  assert.equal(executions, 0);
  await interactionCreate.execute(interaction(), client);
  assert.equal(executions, 1);
  await interactionCreate.execute(interaction('manager', PermissionFlagsBits.ManageGuild), client);
  assert.equal(executions, 2);
});

test('owner can view sticky messages without ManageMessages', async () => {
  let reply;
  await sticky.execute({ ...interaction(), channel: { id: 'channel', isTextBased: () => true },
    options: { getChannel: () => null, getSubcommand: () => 'view' },
    reply: async payload => { reply = payload; } }, { db: { get: async () => ({ content: 'Owner sticky' }) } });
  assert.match(reply.content, /Owner sticky/);
});

for (const name of ['claim', 'unclaim']) {
  test(`owner can ${name} a ticket assigned to another staff member`, async () => {
    const ticket = normalizeTicket({ id: '1', guildId: 'test-guild', channelId: 'channel',
      creatorId: 'creator', assignedStaffId: 'other-staff', status: 'claimed' });
    const values = new Map([['community:test-guild:ticket:channel', ticket]]);
    const client = { db: { get: async (key, fallback) => values.get(key) ?? fallback,
      set: async (key, value) => { values.set(key, value); } } };
    await ticketCommand(name).execute({ ...interaction(), guild: { ownerId: 'guild-owner' }, channel: {} }, client);
    assert.equal(values.get('community:test-guild:ticket:channel').assignedStaffId,
      name === 'claim' ? BOT_OWNER_USER_ID : null);
  });
}
