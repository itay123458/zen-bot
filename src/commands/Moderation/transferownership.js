import {
    SlashCommandBuilder,
    PermissionFlagsBits,
    ButtonBuilder,
    ButtonStyle,
    ActionRowBuilder,
    MessageFlags,
} from 'discord.js';
import { createEmbed, errorEmbed, successEmbed } from '../../utils/embeds.js';

export default {
    data: new SlashCommandBuilder()
        .setName('transferownership')
        .setDescription('Transfer server ownership to another member')
        .addUserOption(o =>
            o.setName('user').setDescription('The member to transfer ownership to').setRequired(true)
        )
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
    category: 'moderation',

    async execute(interaction) {
        if (interaction.user.id !== interaction.guild.ownerId) {
            return interaction.reply({
                embeds: [errorEmbed('Not Allowed', 'Only the server owner can transfer ownership.')],
                flags: MessageFlags.Ephemeral,
            });
        }

        const target = interaction.options.getMember('user');

        if (!target) {
            return interaction.reply({
                embeds: [errorEmbed('Not Found', 'That user is not in this server.')],
                flags: MessageFlags.Ephemeral,
            });
        }

        if (target.id === interaction.user.id) {
            return interaction.reply({
                embeds: [errorEmbed('Invalid', 'You are already the server owner.')],
                flags: MessageFlags.Ephemeral,
            });
        }

        const confirmId = `transferowner-confirm-${interaction.id}`;
        const cancelId = `transferowner-cancel-${interaction.id}`;

        const embed = createEmbed({
            title: '👑 Transfer Ownership',
            description: `Are you sure you want to transfer ownership of **${interaction.guild.name}** to ${target}?\n\nYou will lose your owner status and **cannot undo this** without the new owner's consent.`,
            color: 'warning',
        });

        const cancelButton = new ButtonBuilder()
            .setCustomId(cancelId)
            .setLabel('Cancel')
            .setStyle(ButtonStyle.Secondary);

        const confirmButton = new ButtonBuilder()
            .setCustomId(confirmId)
            .setLabel('Yes, transfer ownership')
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
                await i.deferUpdate().catch(() => {});
                try {
                    await interaction.guild.setOwner(target);
                    await interaction.editReply({
                        embeds: [successEmbed(
                            'Ownership Transferred',
                            `${target} is now the owner of **${interaction.guild.name}**.`,
                        )],
                        components: [],
                    });
                } catch {
                    await interaction.editReply({
                        embeds: [errorEmbed('Failed', 'Could not transfer ownership. The bot must be the server owner to perform this action.')],
                        components: [],
                    });
                }
            } else {
                await i.update({
                    embeds: [createEmbed({
                        title: 'Cancelled',
                        description: 'Ownership transfer cancelled.',
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
                        description: 'Ownership transfer cancelled — no response within 30 seconds.',
                        color: 'secondary',
                    })],
                    components: [],
                }).catch(() => {});
            }
        });
    },
};
