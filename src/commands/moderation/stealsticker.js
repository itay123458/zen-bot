import { MessageFlags, PermissionFlagsBits, SlashCommandBuilder } from 'discord.js';
import { AccessLevel, requireAccess } from '../../modules/community/permissions.js';
import { createEmbed } from '../../utils/embeds.js';
import { logEvent } from '../../services/loggingService.js';
import logger from '../../utils/logger.js';

const EPHEMERAL = MessageFlags.Ephemeral;
const MAX_STICKER_BYTES = 512 * 1024;

export function parseDiscordMessageLink(value) {
  const match = String(value || '').trim().match(
    /^https?:\/\/(?:www\.)?(?:discord\.com|discordapp\.com)\/channels\/(\d{17,20}|@me)\/(\d{17,20})\/(\d{17,20})(?:\?.*)?$/i,
  );
  return match ? { guildId: match[1], channelId: match[2], messageId: match[3] } : null;
}

function response(title, description, color = 'primary') {
  return { embeds: [createEmbed({ title, description, color, footer: { text: 'EditIL Assistant • ניהול מדבקות' } })], flags: EPHEMERAL };
}

function editResponse(title, description, color = 'primary') {
  return { embeds: response(title, description, color).embeds };
}

export default {
  data: new SlashCommandBuilder()
    .setName('stealsticker')
    .setDescription('העתקת מדבקה מהודעת Discord אל השרת')
    .setDMPermission(false)
    .addStringOption(option => option
      .setName('message_link')
      .setDescription('קישור להודעה שמכילה את המדבקה')
      .setRequired(true))
    .addStringOption(option => option
      .setName('name')
      .setDescription('שם חדש למדבקה; אם לא צוין, יישמר השם המקורי')
      .setMinLength(2)
      .setMaxLength(30))
    .addStringOption(option => option
      .setName('emoji')
      .setDescription('אימוג׳י שמתאר את המדבקה, לדוגמה 🔥')
      .setMaxLength(50))
    .addStringOption(option => option
      .setName('description')
      .setDescription('תיאור אופציונלי למדבקה')
      .setMaxLength(100)),

  async execute(interaction, client) {
    if (!await requireAccess(interaction, client, AccessLevel.ADMIN)) return;

    const botMember = interaction.guild.members.me;
    if (!botMember?.permissions.has(PermissionFlagsBits.ManageGuildExpressions)) {
      return interaction.reply(response('אין הרשאה', 'לבוט חסרה ההרשאה **ניהול ביטויים** (`Manage Expressions`).', 'error'));
    }

    const link = parseDiscordMessageLink(interaction.options.getString('message_link'));
    if (!link) {
      return interaction.reply(response('קישור לא תקין', 'יש להדביק קישור מלא להודעת Discord שמכילה מדבקה.', 'error'));
    }

    await interaction.deferReply({ flags: EPHEMERAL });

    try {
      const channel = await client.channels.fetch(link.channelId);
      if (!channel?.isTextBased() || !channel.messages) {
        return interaction.editReply(editResponse('לא ניתן לקרוא את ההודעה', 'הקישור אינו מפנה לערוץ טקסט שהבוט יכול לקרוא.', 'error'));
      }

      const message = await channel.messages.fetch(link.messageId);
      const source = message.stickers.first();
      if (!source) {
        return interaction.editReply(editResponse('לא נמצאה מדבקה', 'ההודעה שבקישור אינה מכילה מדבקה.', 'warning'));
      }

      const existing = await interaction.guild.stickers.fetch();
      const desiredName = interaction.options.getString('name') || source.name;
      if (existing.some(sticker => sticker.name.toLowerCase() === desiredName.toLowerCase())) {
        return interaction.editReply(editResponse('השם כבר קיים', `כבר קיימת בשרת מדבקה בשם **${desiredName}**. בחרו שם אחר.`, 'warning'));
      }

      const download = await fetch(source.url);
      if (!download.ok) throw new Error(`Sticker download returned HTTP ${download.status}`);
      const declaredSize = Number(download.headers.get('content-length') || 0);
      if (declaredSize > MAX_STICKER_BYTES) {
        return interaction.editReply(editResponse('הקובץ גדול מדי', 'גודל המדבקה גדול מהמגבלה של Discord ‏(512KB).', 'error'));
      }

      const file = Buffer.from(await download.arrayBuffer());
      if (file.byteLength > MAX_STICKER_BYTES) {
        return interaction.editReply(editResponse('הקובץ גדול מדי', 'גודל המדבקה גדול מהמגבלה של Discord ‏(512KB).', 'error'));
      }

      const sticker = await interaction.guild.stickers.create({
        file,
        name: desiredName,
        tags: interaction.options.getString('emoji') || source.tags || '✨',
        description: interaction.options.getString('description') || source.description || 'נוסף באמצעות EditIL Assistant',
        reason: `Sticker copied by ${interaction.user.tag} (${interaction.user.id})`,
      });

      await logEvent(client, interaction.guild, 'emoji_sticker.change', {
        title: 'מדבקה הועתקה לשרת',
        description: `**${sticker.name}** נוספה על ידי ${interaction.user}.`,
        fields: [
          { name: 'מזהה המדבקה', value: sticker.id, inline: true },
          { name: 'מקור', value: `[מעבר להודעה](${interaction.options.getString('message_link')})`, inline: true },
        ],
      });

      return interaction.editReply(editResponse('המדבקה נוספה בהצלחה', `המדבקה **${sticker.name}** הועתקה אל השרת.`));
    } catch (error) {
      logger.error('Failed to copy sticker', {
        guildId: interaction.guildId,
        userId: interaction.user.id,
        error: error.stack || error.message,
      });
      const unavailable = error.code === 10008 || error.code === 10003 || error.status === 403;
      return interaction.editReply(editResponse(
        'לא ניתן להעתיק את המדבקה',
        unavailable
          ? 'הבוט אינו יכול לקרוא את ההודעה או הערוץ. ודאו שהקישור תקין ושיש לבוט גישה.'
          : 'Discord דחה את יצירת המדבקה. בדקו שיש מקום פנוי, שהשם תקין ושהקובץ נתמך.',
        'error',
      ));
    }
  },
};
