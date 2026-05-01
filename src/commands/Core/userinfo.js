import { SlashCommandBuilder } from 'discord.js';
import { createEmbed } from '../../utils/embeds.js';
import { logger } from '../../utils/logger.js';
import { handleInteractionError } from '../../utils/errorHandler.js';
import { InteractionHelper } from '../../utils/interactionHelper.js';

export default {
    data: new SlashCommandBuilder()
        .setName('userinfo')
        .setDescription('View detailed information about a user')
        .addUserOption(option =>
            option.setName('user').setDescription('The user to look up').setRequired(false)
        ),

    async execute(interaction) {
        try {
            await InteractionHelper.safeDefer(interaction);

            const targetUser = interaction.options.getUser('user') || interaction.user;
            const member = await interaction.guild?.members.fetch(targetUser.id).catch(() => null);

            const createdAt = Math.floor(targetUser.createdTimestamp / 1000);
            const joinedAt = member?.joinedTimestamp ? Math.floor(member.joinedTimestamp / 1000) : null;

            const topRoles = member?.roles.cache
                .filter(r => r.id !== interaction.guild.id)
                .sort((a, b) => b.position - a.position)
                .map(r => r.toString())
                .slice(0, 10) || [];

            const roleCount = (member?.roles.cache.size ?? 1) - 1;

            const fields = [
                { name: 'User ID', value: targetUser.id, inline: true },
                { name: 'Bot', value: targetUser.bot ? 'Yes' : 'No', inline: true },
                { name: 'Account Created', value: `<t:${createdAt}:F> (<t:${createdAt}:R>)`, inline: false },
            ];

            if (joinedAt) {
                fields.push({ name: 'Joined Server', value: `<t:${joinedAt}:F> (<t:${joinedAt}:R>)`, inline: false });
            }
            if (member?.nickname) {
                fields.push({ name: 'Nickname', value: member.nickname, inline: true });
            }
            if (member?.premiumSinceTimestamp) {
                fields.push({ name: 'Boosting Since', value: `<t:${Math.floor(member.premiumSinceTimestamp / 1000)}:R>`, inline: true });
            }
            if (topRoles.length > 0) {
                const overflow = roleCount > 10 ? ` (+${roleCount - 10} more)` : '';
                fields.push({ name: `Roles (${roleCount})`, value: topRoles.join(' ') + overflow, inline: false });
            }

            const embed = createEmbed({
                title: `User Info — ${targetUser.username}`,
                thumbnail: targetUser.displayAvatarURL({ size: 256 }),
                fields,
                color: targetUser.bot ? 'blurple' : 'primary',
            });

            await InteractionHelper.safeEditReply(interaction, { embeds: [embed] });
            logger.debug(`Userinfo command used for ${targetUser.id} by ${interaction.user.id}`);
        } catch (error) {
            logger.error('Userinfo command error:', error);
            await handleInteractionError(interaction, error, { commandName: 'userinfo' });
        }
    },
};
