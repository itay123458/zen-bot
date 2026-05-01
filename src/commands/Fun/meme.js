import { SlashCommandBuilder } from 'discord.js';
import { createEmbed, errorEmbed } from '../../utils/embeds.js';
import { logger } from '../../utils/logger.js';
import { handleInteractionError } from '../../utils/errorHandler.js';
import { InteractionHelper } from '../../utils/interactionHelper.js';

export default {
    data: new SlashCommandBuilder()
        .setName('meme')
        .setDescription('Get a random meme'),

    async execute(interaction) {
        try {
            await InteractionHelper.safeDefer(interaction);

            const res = await fetch('https://meme-api.com/gimme');

            if (!res.ok) {
                return InteractionHelper.safeEditReply(interaction, {
                    embeds: [errorEmbed('Failed', 'Could not fetch a meme right now. Try again later.')],
                });
            }

            const data = await res.json();

            if (data.nsfw) {
                return InteractionHelper.safeEditReply(interaction, {
                    embeds: [errorEmbed('NSFW', 'The fetched meme was NSFW. Try again!')],
                });
            }

            const embed = createEmbed({
                title: data.title,
                color: 'blurple',
                footer: { text: `r/${data.subreddit} • 👍 ${data.ups}` },
                timestamp: false,
            });
            embed.setImage(data.url);
            embed.setURL(data.postLink);

            await InteractionHelper.safeEditReply(interaction, { embeds: [embed] });
            logger.info(`Meme: ${interaction.user.id} got meme from r/${data.subreddit}`);
        } catch (error) {
            logger.error('Meme command error:', error);
            await handleInteractionError(interaction, error, { commandName: 'meme' });
        }
    },
};
