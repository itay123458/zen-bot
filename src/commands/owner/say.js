import { MessageFlags, SlashCommandBuilder } from 'discord.js';
import { OWNER_INBOX_USER_ID } from '../../services/ownerInboxService.js';
import logger from '../../utils/logger.js';

export async function downloadSayAttachment(attachment) {
  const response = await fetch(attachment.url);
  if (!response.ok) throw new Error(`ATTACHMENT_DOWNLOAD_FAILED:${response.status}`);
  return {
    attachment: Buffer.from(await response.arrayBuffer()),
    name: attachment.name || 'video.mp4',
    description: attachment.description || undefined,
  };
}

function sayFailureMessage(error) {
  if (error?.name === 'AbortError') {
    return 'העלאת הסרטון ארכה יותר מדי זמן. נסו קובץ קטן יותר או חיבור מהיר יותר.';
  }
  if (error?.code === 40005 || error?.status === 413) {
    return 'הקובץ גדול ממגבלת ההעלאה של הבוט בשרת. נסו להקטין או לדחוס את הסרטון.';
  }
  if (error?.code === 50013) {
    return 'לבוט חסרה הרשאת „צירוף קבצים” בערוץ הזה.';
  }
  if (String(error?.message).startsWith('ATTACHMENT_DOWNLOAD_FAILED:')) {
    return 'לא ניתן היה להוריד את הסרטון מ־Discord. נסו להעלות אותו מחדש.';
  }
  return 'לא ניתן היה לשלוח את ההודעה. נסו שוב או בדקו את הרשאות הבוט בערוץ.';
}

export default {
  data: new SlashCommandBuilder()
    .setName('say')
    .setDescription('שליחת הודעה בערוץ הנוכחי בשם הבוט')
    .setDMPermission(false)
    .addStringOption(option => option
      .setName('message')
      .setDescription('הטקסט שהבוט ישלח')
      .setRequired(false)
      .setMaxLength(2000))
    .addAttachmentOption(option => option
      .setName('video')
      .setDescription('סרטון או קובץ שהבוט יעלה')
      .setRequired(false)),

  async execute(interaction) {
    if (interaction.user.id !== OWNER_INBOX_USER_ID) {
      return interaction.reply({
        content: 'רק בעל הבוט יכול להשתמש בפקודה הזאת.',
        flags: MessageFlags.Ephemeral,
      });
    }

    if (!interaction.channel?.isTextBased()) {
      return interaction.reply({
        content: 'לא ניתן לשלוח הודעה בערוץ הזה.',
        flags: MessageFlags.Ephemeral,
      });
    }

    const content = interaction.options.getString('message')?.trim() || null;
    const video = interaction.options.getAttachment('video');
    if (!content && !video) {
      return interaction.reply({
        content: 'יש לצרף טקסט, סרטון או את שניהם.',
        flags: MessageFlags.Ephemeral,
      });
    }
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    try {
      const file = video ? await downloadSayAttachment(video) : null;
      const message = await interaction.channel.send({
        content: content || undefined,
        files: file ? [file] : [],
        allowedMentions: { parse: [], users: [], roles: [] },
      });
      logger.info('Owner sent a message as the bot', {
        guildId: interaction.guildId,
        channelId: interaction.channelId,
        userId: interaction.user.id,
        messageId: message.id,
        attachmentId: video?.id || null,
      });
      return interaction.editReply(`ההודעה נשלחה בהצלחה: ${message.url}`);
    } catch (error) {
      logger.error('Failed to send owner message as the bot', {
        guildId: interaction.guildId,
        channelId: interaction.channelId,
        userId: interaction.user.id,
        error: error.stack || error.message,
      });
      return interaction.editReply(sayFailureMessage(error));
    }
  },
};
