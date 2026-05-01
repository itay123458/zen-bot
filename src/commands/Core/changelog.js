import { SlashCommandBuilder, PermissionFlagsBits, MessageFlags } from 'discord.js';
import { createEmbed, errorEmbed } from '../../utils/embeds.js';
import { logger } from '../../utils/logger.js';
import { handleInteractionError } from '../../utils/errorHandler.js';
import { InteractionHelper } from '../../utils/interactionHelper.js';
import { changelog, typeEmoji } from '../../config/changelog.js';

export default {
    data: new SlashCommandBuilder()
        .setName('changelog')
        .setDescription('Post the bot changelog to this channel')
        .addBooleanOption(option =>
            option
                .setName('all')
                .setDescription('Show all versions instead of just the latest')
                .setRequired(false)
        )
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

    async execute(interaction) {
        try {
            const showAll = interaction.options.getBoolean('all') ?? false;
            const versions = showAll ? changelog : [changelog[0]];

            await InteractionHelper.safeDefer(interaction, { ephemeral: true });

            for (const version of versions) {
                const lines = version.entries.map(e =>
                    `${typeEmoji[e.type] ?? '•'} ${e.text}`
                ).join('\n');

                const embed = createEmbed({
                    title: `📋 Changelog — v${version.version}`,
                    description: lines,
                    color: 'blurple',
                    footer: { text: `Released ${version.date}` },
                    timestamp: false,
                });

                await interaction.channel.send({ embeds: [embed] });
            }

            await InteractionHelper.safeEditReply(interaction, {
                content: `Posted ${versions.length === 1 ? 'latest version' : 'all versions'}.`,
                flags: [MessageFlags.Ephemeral],
            });

            logger.info(`Changelog posted by ${interaction.user.id} in ${interaction.channel.id}`);
        } catch (error) {
            logger.error('Changelog command error:', error);
            await handleInteractionError(interaction, error, { commandName: 'changelog' });
        }
    },
};
