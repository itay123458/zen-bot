import {
    SlashCommandBuilder,
    PermissionFlagsBits,
    ButtonBuilder,
    ButtonStyle,
    ActionRowBuilder,
    MessageFlags,
} from 'discord.js';
import { createEmbed, errorEmbed } from '../../utils/embeds.js';

export default {
    data: new SlashCommandBuilder()
        .setName('deleteserver')
        .setDescription('Permanently delete this server — this cannot be undone')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
    category: 'moderation',

    async execute(interaction) {
        if (interaction.user.id !== interaction.guild.ownerId) {
            return interaction.reply({
                embeds: [errorEmbed('Not Allowed', 'Only the server owner can delete the server.')],
                flags: MessageFlags.Ephemeral,
            });
        }

        const confirmId = `deleteserver-confirm-${interaction.id}`;
        const cancelId = `deleteserver-cancel-${interaction.id}`;

        const embed = createEmbed({
            title: '⚠️ Delete Server',
            description: `Are you sure you want to **permanently delete** \`${interaction.guild.name}\`?\n\nAll channels, roles, and data will be lost forever. **This cannot be undone.**`,
            color: 'error',
        });

        const cancelButton = new ButtonBuilder()
            .setCustomId(cancelId)
            .setLabel('Cancel')
            .setStyle(ButtonStyle.Secondary);

        const confirmButton = new ButtonBuilder()
            .setCustomId(confirmId)
            .setLabel('Yes, delete the server')
            .setStyle(ButtonStyle.Danger);

        const row = new ActionRowBuilder().addComponents(cancelButton, confirmButton);

        await interaction.reply({
            embeds: [embed],
            components: [row],
            flags: MessageFlags.Ephemeral,
        });

        const collector = interaction.channel.createMessageComponentCollector({
            filter: i => i.user.id === interaction.user.id && [confirmId, cancelId].includes(i.customId),
            time: 30_000,
            max: 1,
        });

        collector.on('collect', async i => {
            if (i.customId === confirmId) {
                await i.update({ content: 'Deleting server...', embeds: [], components: [] }).catch(() => {});
                await interaction.guild.delete().catch(async () => {
                    await interaction.editReply({
                        content: '',
                        embeds: [errorEmbed('Failed', 'Could not delete the server. The bot must be the server owner to perform this action.')],
                        components: [],
                    }).catch(() => {});
                });
            } else {
                await i.update({
                    embeds: [createEmbed({
                        title: 'Cancelled',
                        description: 'Server deletion cancelled.',
                        color: 'secondary',
                    })],
                    components: [],
                });
            }
        });

        collector.on('end', collected => {
            if (!collected.size) {
                interaction.editReply({
                    embeds: [createEmbed({
                        title: 'Timed Out',
                        description: 'Server deletion cancelled — no response within 30 seconds.',
                        color: 'secondary',
                    })],
                    components: [],
                }).catch(() => {});
            }
        });
    },
};
