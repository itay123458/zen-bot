import { SlashCommandBuilder, PermissionFlagsBits, MessageFlags, WebhookClient } from 'discord.js';
import { errorEmbed, successEmbed } from '../../utils/embeds.js';
import { logger } from '../../utils/logger.js';
import { handleInteractionError } from '../../utils/errorHandler.js';
import { InteractionHelper } from '../../utils/interactionHelper.js';

const DISCORD_WEBHOOK_REGEX = /^https:\/\/discord(?:app)?\.com\/api\/webhooks\/\d+\/.+$/;

export default {
    data: new SlashCommandBuilder()
        .setName('fakemessage')
        .setDescription('Create a fake Discord message')
        .addUserOption(option =>
            option.setName('user').setDescription('The user to impersonate').setRequired(true)
        )
        .addStringOption(option =>
            option.setName('message').setDescription('The message to send').setRequired(true).setMaxLength(2000)
        )
        .addStringOption(option =>
            option.setName('webhook_url').setDescription('Webhook URL of a channel in any server (leave empty to use current channel)').setRequired(false)
        )
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    async execute(interaction) {
        try {
            const targetUser = interaction.options.getUser('user');
            const message = interaction.options.getString('message');
            const webhookUrl = interaction.options.getString('webhook_url');

            const member = await interaction.guild.members.fetch(targetUser.id).catch(() => null);
            const displayName = member?.displayName ?? targetUser.username;
            const avatarURL = targetUser.displayAvatarURL({ size: 256 });

            if (webhookUrl) {
                if (!DISCORD_WEBHOOK_REGEX.test(webhookUrl)) {
                    return InteractionHelper.safeReply(interaction, {
                        embeds: [errorEmbed('Invalid Webhook', 'Please provide a valid Discord webhook URL.')],
                        flags: [MessageFlags.Ephemeral],
                    });
                }

                const client = new WebhookClient({ url: webhookUrl });
                await client.send({ content: message, username: displayName, avatarURL });
                client.destroy();
            } else {
                if (!interaction.channel.isTextBased() || interaction.channel.isDMBased()) {
                    return InteractionHelper.safeReply(interaction, {
                        embeds: [errorEmbed('Invalid Channel', 'This command can only be used in text channels.')],
                        flags: [MessageFlags.Ephemeral],
                    });
                }

                const webhooks = await interaction.channel.fetchWebhooks();
                let webhook = webhooks.find(wh => wh.owner?.id === interaction.client.user.id);

                if (!webhook) {
                    webhook = await interaction.channel.createWebhook({
                        name: 'itay100k bot',
                        avatar: interaction.client.user.displayAvatarURL(),
                    });
                }

                await webhook.send({ content: message, username: displayName, avatarURL });
            }

            await InteractionHelper.safeReply(interaction, {
                embeds: [successEmbed('Sent', `Message sent as **${displayName}**.`)],
                flags: [MessageFlags.Ephemeral],
            });

            logger.info(`Fakemessage: ${interaction.user.id} impersonated ${targetUser.id} in ${interaction.channel.id}`);
        } catch (error) {
            logger.error('Fakemessage command error:', error);
            await handleInteractionError(interaction, error, { commandName: 'fakemessage' });
        }
    },
};
