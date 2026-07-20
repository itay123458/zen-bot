import { MessageFlags, SlashCommandBuilder } from 'discord.js';
import { execFile } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { extname, join } from 'node:path';
import { promisify } from 'node:util';
import { OWNER_INBOX_USER_ID } from '../../services/ownerInboxService.js';
import logger from '../../utils/logger.js';

const execFileAsync = promisify(execFile);
const SAFE_UPLOAD_BYTES = 9_500_000;
const MAX_SOURCE_BYTES = 250_000_000;

async function compressSayVideo(buffer, attachment) {
  const directory = await mkdtemp(join(tmpdir(), 'editil-say-'));
  const extension = extname(attachment.name || '').toLowerCase().replace(/[^.\w]/g, '') || '.mp4';
  const input = join(directory, `input${extension}`);
  const output = join(directory, 'compressed.mp4');
  const passlog = join(directory, 'ffmpeg-pass');
  try {
    await writeFile(input, buffer);
    const { stdout } = await execFileAsync('ffprobe', [
      '-v', 'error',
      '-show_entries', 'format=duration',
      '-of', 'default=noprint_wrappers=1:nokey=1',
      input,
    ], { timeout: 60_000 });
    const duration = Number.parseFloat(stdout);
    if (!Number.isFinite(duration) || duration <= 0) throw new Error('SAY_COMPRESSION_FAILED:DURATION');
    const audioBitrate = 96_000;
    const totalBitrate = Math.floor((SAFE_UPLOAD_BYTES * 8 * 0.96) / duration);
    const videoBitrate = Math.max(150_000, totalBitrate - audioBitrate);
    const common = [
      '-y', '-i', input,
      '-c:v', 'libx264',
      '-preset', 'veryfast',
      '-b:v', String(videoBitrate),
      '-maxrate', String(Math.floor(videoBitrate * 1.15)),
      '-bufsize', String(videoBitrate * 2),
      '-pix_fmt', 'yuv420p',
      '-passlogfile', passlog,
    ];
    await execFileAsync('ffmpeg', [
      ...common,
      '-pass', '1',
      '-an',
      '-f', 'mp4',
      process.platform === 'win32' ? 'NUL' : '/dev/null',
    ], { timeout: 600_000, windowsHide: true });
    await execFileAsync('ffmpeg', [
      ...common,
      '-pass', '2',
      '-c:a', 'aac',
      '-b:a', '96k',
      '-movflags', '+faststart',
      output,
    ], { timeout: 600_000, windowsHide: true });
    const compressed = await readFile(output);
    if (compressed.length > SAFE_UPLOAD_BYTES) throw new Error('SAY_COMPRESSION_FAILED:SIZE');
    return compressed;
  } catch (error) {
    if (String(error?.message).startsWith('SAY_COMPRESSION_FAILED:')) throw error;
    throw new Error(`SAY_COMPRESSION_FAILED:${error?.message || 'UNKNOWN'}`);
  } finally {
    await rm(directory, { recursive: true, force: true }).catch(() => {});
  }
}

export async function downloadSayAttachment(
  attachment,
  { fetchImpl = fetch, compressor = compressSayVideo } = {},
) {
  if (attachment.size > MAX_SOURCE_BYTES) throw new Error('SAY_SOURCE_TOO_LARGE');
  const response = await fetchImpl(attachment.url);
  if (!response.ok) throw new Error(`ATTACHMENT_DOWNLOAD_FAILED:${response.status}`);
  const source = Buffer.from(await response.arrayBuffer());
  if (source.length > MAX_SOURCE_BYTES) throw new Error('SAY_SOURCE_TOO_LARGE');
  const needsCompression = source.length > SAFE_UPLOAD_BYTES;
  const isVideo = attachment.contentType?.startsWith('video/')
    || /\.(mp4|mov|mkv|webm|avi|m4v)$/i.test(attachment.name || '');
  if (needsCompression && !isVideo) throw new Error('SAY_FILE_TOO_LARGE');
  const contents = needsCompression ? await compressor(source, attachment) : source;
  return {
    attachment: contents,
    name: needsCompression
      ? `${(attachment.name || 'video').replace(/\.[^.]+$/, '')}-compressed.mp4`
      : attachment.name || 'video.mp4',
    description: attachment.description || undefined,
    compressed: needsCompression,
  };
}

function sayFailureMessage(error) {
  if (error?.name === 'AbortError') {
    return 'העלאת הסרטון ארכה יותר מדי זמן. נסו קובץ קטן יותר או חיבור מהיר יותר.';
  }
  if (error?.code === 40005 || error?.status === 413) {
    return 'הקובץ גדול ממגבלת ההעלאה של הבוט בשרת. נסו להקטין או לדחוס את הסרטון.';
  }
  if (error?.message === 'SAY_SOURCE_TOO_LARGE') {
    return 'קובץ המקור גדול מדי לעיבוד אוטומטי. המגבלה היא 250 MB.';
  }
  if (error?.message === 'SAY_FILE_TOO_LARGE') {
    return 'הקובץ גדול מדי ואינו מזוהה כסרטון שניתן לדחוס.';
  }
  if (String(error?.message).startsWith('SAY_COMPRESSION_FAILED:')) {
    return 'לא ניתן היה לדחוס את הסרטון. נסו סרטון MP4 קצר יותר או קובץ קטן יותר.';
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
        files: file ? [{
          attachment: file.attachment,
          name: file.name,
          description: file.description,
        }] : [],
        allowedMentions: { parse: [], users: [], roles: [] },
      });
      logger.info('Owner sent a message as the bot', {
        guildId: interaction.guildId,
        channelId: interaction.channelId,
        userId: interaction.user.id,
        messageId: message.id,
        attachmentId: video?.id || null,
        compressed: file?.compressed || false,
      });
      return interaction.editReply(
        `${file?.compressed ? 'הסרטון נדחס אוטומטית ונשלח בהצלחה' : 'ההודעה נשלחה בהצלחה'}: ${message.url}`,
      );
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
