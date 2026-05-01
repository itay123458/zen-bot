import { SlashCommandBuilder } from 'discord.js';
import { createEmbed } from '../../utils/embeds.js';
import { logger } from '../../utils/logger.js';
import { handleInteractionError } from '../../utils/errorHandler.js';
import { InteractionHelper } from '../../utils/interactionHelper.js';

const VERIFICATION_LEVELS = ['None', 'Low', 'Medium', 'High', 'Highest'];

export default {
    data: new SlashCommandBuilder()
        .setName('serverinfo')
        .setDescription('Display information about this server'),

    async execute(interaction) {
        try {
            await InteractionHelper.safeDefer(interaction);

            const guild = interaction.guild;
            await guild.fetch();

            const owner = await guild.fetchOwner().catch(() => null);
            const createdAt = Math.floor(guild.createdTimestamp / 1000);

            const textChannels = guild.channels.cache.filter(c => c.type === 0).size;
            const voiceChannels = guild.channels.cache.filter(c => c.type === 2).size;
            const categories = guild.channels.cache.filter(c => c.type === 4).size;
            const bots = guild.members.cache.filter(m => m.user.bot).size;
            const humans = guild.memberCount - bots;

            const embed = createEmbed({
                title: `Server Info — ${guild.name}`,
                thumbnail: guild.iconURL({ size: 256 }),
                color: 'blurple',
                fields: [
                    { name: 'Owner', value: owner ? `${owner}` : 'Unknown', inline: true },
                    { name: 'Server ID', value: guild.id, inline: true },
                    { name: 'Created', value: `<t:${createdAt}:F> (<t:${createdAt}:R>)`, inline: false },
                    { name: 'Members', value: `**${guild.memberCount}** total — ${humans} humans, ${bots} bots`, inline: false },
                    { name: 'Channels', value: `${textChannels} text · ${voiceChannels} voice · ${categories} categories`, inline: false },
                    { name: 'Roles', value: `${guild.roles.cache.size}`, inline: true },
                    { name: 'Emojis', value: `${guild.emojis.cache.size}`, inline: true },
                    { name: 'Boosts', value: `${guild.premiumSubscriptionCount} (Level ${guild.premiumTier})`, inline: true },
                    { name: 'Verification', value: VERIFICATION_LEVELS[guild.verificationLevel] ?? 'Unknown', inline: true },
                ],
            });

            await InteractionHelper.safeEditReply(interaction, { embeds: [embed] });
            logger.debug(`Serverinfo command used by ${interaction.user.id} in guild ${guild.id}`);
        } catch (error) {
            logger.error('Serverinfo command error:', error);
            await handleInteractionError(interaction, error, { commandName: 'serverinfo' });
        }
    },
};
