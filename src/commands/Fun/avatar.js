import { SlashCommandBuilder } from 'discord.js';
import { createEmbed } from '../../utils/embeds.js';
import { logger } from '../../utils/logger.js';
import { handleInteractionError } from '../../utils/errorHandler.js';
import { InteractionHelper } from '../../utils/interactionHelper.js';

export default {
    data: new SlashCommandBuilder()
        .setName('avatar')
        .setDescription("Display a user's avatar in full size")
        .addUserOption(option =>
            option.setName('user').setDescription('The user whose avatar to display').setRequired(false)
        ),

    async execute(interaction) {
        try {
            const targetUser = interaction.options.getUser('user') || interaction.user;
            const member = await interaction.guild?.members.fetch(targetUser.id).catch(() => null);

            const globalAvatar = targetUser.displayAvatarURL({ size: 4096 });
            const serverAvatar = member?.avatarURL({ size: 4096 });

            const displayAvatar = serverAvatar || globalAvatar;
            const links = [`[Global Avatar](${globalAvatar})`];
            if (serverAvatar && serverAvatar !== globalAvatar) {
                links.unshift(`[Server Avatar](${serverAvatar})`);
            }

            const embed = createEmbed({
                title: `${targetUser.username}'s Avatar`,
                description: links.join(' • '),
                image: displayAvatar,
                color: 'blurple',
            });

            await InteractionHelper.safeReply(interaction, { embeds: [embed] });
            logger.debug(`Avatar command used for ${targetUser.id} by ${interaction.user.id}`);
        } catch (error) {
            logger.error('Avatar command error:', error);
            await handleInteractionError(interaction, error, { commandName: 'avatar' });
        }
    },
};
