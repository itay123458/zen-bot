import { SlashCommandBuilder } from 'discord.js';
import { createEmbed, errorEmbed } from '../../utils/embeds.js';
import { logger } from '../../utils/logger.js';
import { handleInteractionError } from '../../utils/errorHandler.js';
import { InteractionHelper } from '../../utils/interactionHelper.js';

export default {
    data: new SlashCommandBuilder()
        .setName('github')
        .setDescription('Look up a GitHub user or repository')
        .addStringOption(option =>
            option.setName('query').setDescription('Username or user/repo (e.g. "torvalds" or "torvalds/linux")').setRequired(true)
        ),

    async execute(interaction) {
        try {
            await InteractionHelper.safeDefer(interaction);

            const query = interaction.options.getString('query').trim();
            const isRepo = query.includes('/');
            const url = isRepo
                ? `https://api.github.com/repos/${query}`
                : `https://api.github.com/users/${query}`;

            const res = await fetch(url, {
                headers: { 'User-Agent': 'itay100k-bot' },
            });

            if (res.status === 404) {
                return InteractionHelper.safeEditReply(interaction, {
                    embeds: [errorEmbed('Not Found', `No GitHub ${isRepo ? 'repository' : 'user'} found for \`${query}\`.`)],
                });
            }

            if (!res.ok) {
                return InteractionHelper.safeEditReply(interaction, {
                    embeds: [errorEmbed('Failed', 'Could not reach the GitHub API. Try again later.')],
                });
            }

            const data = await res.json();
            let embed;

            if (isRepo) {
                embed = createEmbed({
                    title: data.full_name,
                    description: data.description || 'No description provided.',
                    color: 'blurple',
                    footer: { text: 'GitHub' },
                    timestamp: false,
                });
                embed.setURL(data.html_url);
                embed.addFields(
                    { name: '⭐ Stars', value: data.stargazers_count.toLocaleString(), inline: true },
                    { name: '🍴 Forks', value: data.forks_count.toLocaleString(), inline: true },
                    { name: '👀 Watchers', value: data.watchers_count.toLocaleString(), inline: true },
                    { name: '🐛 Issues', value: data.open_issues_count.toLocaleString(), inline: true },
                    { name: '📝 Language', value: data.language || 'Unknown', inline: true },
                    { name: '📄 License', value: data.license?.name || 'None', inline: true },
                );
            } else {
                embed = createEmbed({
                    title: data.name || data.login,
                    description: data.bio || 'No bio provided.',
                    color: 'blurple',
                    footer: { text: 'GitHub' },
                    timestamp: false,
                });
                embed.setURL(data.html_url);
                embed.setThumbnail(data.avatar_url);
                embed.addFields(
                    { name: '👥 Followers', value: data.followers.toLocaleString(), inline: true },
                    { name: '➡️ Following', value: data.following.toLocaleString(), inline: true },
                    { name: '📦 Repos', value: data.public_repos.toLocaleString(), inline: true },
                );
                if (data.location) embed.addFields({ name: '📍 Location', value: data.location, inline: true });
                if (data.company) embed.addFields({ name: '🏢 Company', value: data.company, inline: true });
            }

            await InteractionHelper.safeEditReply(interaction, { embeds: [embed] });
            logger.info(`GitHub: ${interaction.user.id} looked up ${query}`);
        } catch (error) {
            logger.error('GitHub command error:', error);
            await handleInteractionError(interaction, error, { commandName: 'github' });
        }
    },
};
