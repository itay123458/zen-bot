import { MessageFlags, SlashCommandBuilder } from 'discord.js';
import { BOT_OWNER_USER_ID } from '../../config/owner.js';
import { ANIMAL_COMPANY_CHANNEL_ID, ANIMAL_COMPANY_GUILD_ID, checkAnimalCompanyUpdates, getAnimalCompanyTrackerStatus } from '../../services/animalCompanyUpdateService.js';

export default {
  data: new SlashCommandBuilder().setName('ac').setDescription('Animal Company update tracker').setDMPermission(false).setDefaultMemberPermissions(0)
    .addSubcommandGroup(group => group.setName('mods').setDescription('Manage Animal Company updates')
      .addSubcommand(sub => sub.setName('check').setDescription('Check for and publish new updates now'))
      .addSubcommand(sub => sub.setName('status').setDescription('Show tracker status'))
      .addSubcommand(sub => sub.setName('post').setDescription('Post a custom Animal Company update')
        .addStringOption(option => option.setName('title').setDescription('Update title').setRequired(true).setMaxLength(200))
        .addStringOption(option => option.setName('content').setDescription('Update details').setRequired(true).setMaxLength(4000)))),
  async execute(interaction, client) {
    if (interaction.user.id !== BOT_OWNER_USER_ID) return interaction.reply({ content: 'This command is restricted to the bot owner.', flags: MessageFlags.Ephemeral });
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    const subcommand = interaction.options.getSubcommand();
    if (subcommand === 'status') {
      const state = await getAnimalCompanyTrackerStatus(client);
      return interaction.editReply(`**Animal Company tracker**\nTarget: <#${ANIMAL_COMPANY_CHANNEL_ID}>\nInitialized: **${state.initialized ? 'yes' : 'no'}**\nTracked updates: **${state.seenIds?.length || 0}**\nLast check: **${state.lastCheckedAt || 'never'}**\nLast post: **${state.lastPostAt || 'never'}**`);
    }
    if (subcommand === 'check') {
      const result = await checkAnimalCompanyUpdates(client, { force: true });
      if (!result.ok) return interaction.editReply(result.code === 'database_unavailable' ? 'PostgreSQL is unavailable, so the tracker was not run.' : `I cannot access <#${ANIMAL_COMPANY_CHANNEL_ID}>. Install EditIL Assistant in server ${ANIMAL_COMPANY_GUILD_ID} and grant View Channel, Send Messages, and Embed Links.`);
      return interaction.editReply(`Check complete. Published **${result.posted}** new update(s).`);
    }
    const guild = await client.guilds.fetch(ANIMAL_COMPANY_GUILD_ID).catch(() => null);
    const channel = await guild?.channels.fetch(ANIMAL_COMPANY_CHANNEL_ID).catch(() => null);
    if (!channel?.isTextBased()) return interaction.editReply('The private-server channel is unavailable. Install EditIL Assistant there first.');
    await channel.send({ embeds: [{ color: 0x69c36d, title: interaction.options.getString('title'), description: interaction.options.getString('content'), footer: { text: 'Animal Company update • EditIL Assistant' }, timestamp: new Date().toISOString() }], allowedMentions: { parse: [] } });
    return interaction.editReply(`Update posted in <#${ANIMAL_COMPANY_CHANNEL_ID}>.`);
  },
};
