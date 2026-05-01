import { SlashCommandBuilder } from 'discord.js';
import { createEmbed, errorEmbed } from '../../utils/embeds.js';
import { logger } from '../../utils/logger.js';
import { handleInteractionError } from '../../utils/errorHandler.js';
import { InteractionHelper } from '../../utils/interactionHelper.js';

export default {
    data: new SlashCommandBuilder()
        .setName('quote')
        .setDescription('Get a random inspirational quote'),

    async execute(interaction) {
        try {
            await InteractionHelper.safeDefer(interaction);

            const res = await fetch('https://zenquotes.io/api/random');

            if (!res.ok) {
                return InteractionHelper.safeEditReply(interaction, {
                    embeds: [errorEmbed('Failed', 'Could not fetch a quote right now. Try again later.')],
                });
            }

            const [data] = await res.json();

            const embed = createEmbed({
                description: `*"${data.q}"*\n\n— **${data.a}**`,
                color: 'blurple',
                footer: { text: 'ZenQuotes.io' },
                timestamp: false,
            });

            await InteractionHelper.safeEditReply(interaction, { embeds: [embed] });
            logger.info(`Quote: ${interaction.user.id} got a quote by ${data.a}`);
        } catch (error) {
            logger.error('Quote command error:', error);
            await handleInteractionError(interaction, error, { commandName: 'quote' });
        }
    },
};
