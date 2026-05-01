import { SlashCommandBuilder } from 'discord.js';
import { createEmbed, errorEmbed } from '../../utils/embeds.js';
import { logger } from '../../utils/logger.js';
import { handleInteractionError } from '../../utils/errorHandler.js';
import { InteractionHelper } from '../../utils/interactionHelper.js';

export default {
    data: new SlashCommandBuilder()
        .setName('joke')
        .setDescription('Get a random joke')
        .addStringOption(option =>
            option.setName('type').setDescription('Joke type').setRequired(false)
                .addChoices(
                    { name: 'Any', value: 'Any' },
                    { name: 'Pun', value: 'Pun' },
                    { name: 'Programming', value: 'Programming' },
                    { name: 'Misc', value: 'Misc' },
                    { name: 'Dark', value: 'Dark' },
                )
        ),

    async execute(interaction) {
        try {
            await InteractionHelper.safeDefer(interaction);

            const type = interaction.options.getString('type') ?? 'Any';
            const res = await fetch(`https://v2.jokeapi.dev/joke/${type}?blacklistFlags=racist,sexist`);

            if (!res.ok) {
                return InteractionHelper.safeEditReply(interaction, {
                    embeds: [errorEmbed('Failed', 'Could not fetch a joke right now. Try again later.')],
                });
            }

            const data = await res.json();
            const text = data.type === 'twopart'
                ? `${data.setup}\n\n||${data.delivery}||`
                : data.joke;

            const embed = createEmbed({
                title: `😂 ${data.category} Joke`,
                description: text,
                color: 'yellow',
                footer: { text: 'JokeAPI' },
                timestamp: false,
            });

            await InteractionHelper.safeEditReply(interaction, { embeds: [embed] });
            logger.info(`Joke: ${interaction.user.id} got a ${data.category} joke`);
        } catch (error) {
            logger.error('Joke command error:', error);
            await handleInteractionError(interaction, error, { commandName: 'joke' });
        }
    },
};
