import {
  ChannelType,
  MessageFlags,
  PermissionFlagsBits,
  SlashCommandBuilder,
} from 'discord.js';
import { createEmbed } from '../../utils/embeds.js';
import { warningKey } from '../../modules/community/store.js';
import { requireAccess, AccessLevel } from '../../modules/community/permissions.js';
import { logEvent } from '../../services/loggingService.js';
import logger from '../../utils/logger.js';

const EPHEMERAL = MessageFlags.Ephemeral;
const MAX_DURATION_MS = 28 * 86_400_000;
const NOTE_KEY = (guildId, userId) => `community:${guildId}:modnotes:${userId}`;

const DEFINITIONS = Object.freeze({
  ban: { description: 'חסימת חבר מהשרת', access: AccessLevel.ADMIN, permission: PermissionFlagsBits.BanMembers },
  unban: { description: 'הסרת חסימה ממשתמש לפי מזהה', access: AccessLevel.ADMIN, permission: PermissionFlagsBits.BanMembers },
  softban: { description: 'מחיקת הודעות אחרונות באמצעות חסימה והסרה מיידית', access: AccessLevel.ADMIN, permission: PermissionFlagsBits.BanMembers },
  kick: { description: 'הוצאת חבר מהשרת', permission: PermissionFlagsBits.KickMembers },
  timeout: { description: 'השתקת חבר לזמן מוגדר', permission: PermissionFlagsBits.ModerateMembers },
  untimeout: { description: 'הסרת השתקה זמנית מחבר', permission: PermissionFlagsBits.ModerateMembers },
  warn: { description: 'הוספת אזהרה מתועדת לחבר' },
  warnings: { description: 'הצגת היסטוריית האזהרות של חבר' },
  clearwarnings: { description: 'הסרת אזהרה פעילה אחת או את כולן', access: AccessLevel.ADMIN },
  note: { description: 'הוספת הערת צוות פרטית על חבר' },
  notes: { description: 'הצגת הערות הצוות הפרטיות על חבר' },
  clearnotes: { description: 'מחיקת הערת צוות אחת או את כולן', access: AccessLevel.ADMIN },
  clear: { description: 'מחיקת הודעות עם מסננים שימושיים', permission: PermissionFlagsBits.ManageMessages },
  lock: { description: 'נעילת כתיבה בערוץ ושמירת ההרשאה הקודמת', permission: PermissionFlagsBits.ManageChannels },
  unlock: { description: 'פתיחת ערוץ ושחזור הרשאת הכתיבה הקודמת', permission: PermissionFlagsBits.ManageChannels },
  hide: { description: 'הסתרת ערוץ ושמירת הרשאת הצפייה הקודמת', permission: PermissionFlagsBits.ManageChannels },
  unhide: { description: 'חשיפת ערוץ ושחזור הרשאת הצפייה הקודמת', permission: PermissionFlagsBits.ManageChannels },
  slowmode: { description: 'שינוי מצב איטי בערוץ', permission: PermissionFlagsBits.ManageChannels },
  nick: { description: 'שינוי או איפוס הכינוי של חבר', permission: PermissionFlagsBits.ManageNicknames },
  voicekick: { description: 'ניתוק חבר מערוץ קולי', permission: PermissionFlagsBits.MoveMembers },
});

const memberCommands = new Set([
  'ban', 'softban', 'kick', 'timeout', 'untimeout', 'warn', 'warnings',
  'clearwarnings', 'note', 'notes', 'clearnotes', 'nick', 'voicekick',
]);
const reasonRequired = new Set(['ban', 'softban', 'kick', 'timeout', 'warn', 'note']);
const reasonOptional = new Set(['unban', 'untimeout', 'clearnotes', 'voicekick']);

function addReason(data, required) {
  return data.addStringOption(option => option
    .setName('reason')
    .setDescription(required ? 'הסיבה לפעולה' : 'סיבה או הערה לצוות')
    .setRequired(required)
    .setMaxLength(500));
}

function buildData(name) {
  const definition = DEFINITIONS[name];
  if (!definition) throw new Error(`Unknown moderation command: ${name}`);
  const data = new SlashCommandBuilder()
    .setName(name)
    .setDescription(definition.description)
    .setDMPermission(false);

  if (memberCommands.has(name)) {
    data.addUserOption(option => option
      .setName('member')
      .setDescription('החבר שעליו תבוצע הפעולה')
      .setRequired(true));
  }
  if (name === 'unban') {
    data.addStringOption(option => option
      .setName('user_id')
      .setDescription('מזהה Discord של המשתמש החסום')
      .setRequired(true)
      .setMinLength(17)
      .setMaxLength(20));
  }
  if (name === 'timeout') {
    data.addStringOption(option => option
      .setName('duration')
      .setDescription('משך זמן: לדוגמה 10m, 2h, 1d או 1h30m')
      .setRequired(true)
      .setMaxLength(30));
  }
  if (reasonRequired.has(name)) addReason(data, true);
  else if (reasonOptional.has(name)) addReason(data, false);
  if (['ban', 'softban'].includes(name)) {
    data.addIntegerOption(option => option
      .setName('delete_messages')
      .setDescription('מספר שעות של הודעות למחיקה')
      .setMinValue(0)
      .setMaxValue(168));
  }
  if (['clearwarnings', 'clearnotes'].includes(name)) {
    data.addStringOption(option => option
      .setName(name === 'clearwarnings' ? 'warning_id' : 'note_id')
      .setDescription('מזהה רשומה; השאירו ריק כדי להסיר הכול')
      .setMaxLength(50));
  }
  if (name === 'clear') {
    data
      .addIntegerOption(option => option.setName('amount').setDescription('מספר ההודעות למחיקה').setRequired(true).setMinValue(1).setMaxValue(100))
      .addUserOption(option => option.setName('member').setDescription('מחיקה רק מהחבר הזה'))
      .addStringOption(option => option.setName('type').setDescription('סוג ההודעות למחיקה').addChoices(
        { name: 'הכול', value: 'all' },
        { name: 'הודעות של בוטים', value: 'bots' },
        { name: 'הודעות עם קישורים', value: 'links' },
        { name: 'הודעות עם קבצים', value: 'attachments' },
      ))
      .addStringOption(option => option.setName('contains').setDescription('מחיקה רק אם ההודעה מכילה טקסט זה').setMaxLength(100));
  }
  if (name === 'slowmode') {
    data.addIntegerOption(option => option
      .setName('seconds')
      .setDescription('זמן המתנה בשניות; 0 מבטל')
      .setRequired(true)
      .setMinValue(0)
      .setMaxValue(21_600));
  }
  if (['lock', 'unlock', 'hide', 'unhide', 'slowmode'].includes(name)) {
    data.addChannelOption(option => option
      .setName('channel')
      .setDescription('הערוץ; ברירת המחדל היא הערוץ הנוכחי')
      .addChannelTypes(ChannelType.GuildText));
  }
  if (name === 'nick') {
    data.addStringOption(option => option
      .setName('nickname')
      .setDescription('הכינוי החדש; השאירו ריק כדי לאפס')
      .setMaxLength(32));
  }
  return data;
}

export function parseModerationDuration(value) {
  const source = String(value || '').toLowerCase().replace(/\s+/g, '');
  if (!source || !/^(?:\d+[mhdw])+$/.test(source)) return null;
  const factors = { m: 60_000, h: 3_600_000, d: 86_400_000, w: 604_800_000 };
  let total = 0;
  for (const match of source.matchAll(/(\d+)([mhdw])/g)) total += Number(match[1]) * factors[match[2]];
  return total > 0 && total <= MAX_DURATION_MS ? total : null;
}

function resultEmbed(description, color = 'success', title = '🛡️ ניהול השרת') {
  return createEmbed({ title, description, color, footer: { text: 'EditIL Assistant • מערכת הניהול' } });
}

const respond = (interaction, description, color = 'success', title) => interaction.reply({
  embeds: [resultEmbed(description, color, title)],
  flags: EPHEMERAL,
  allowedMentions: { parse: [] },
});

function targetError(interaction, member) {
  if (!member) return 'החבר לא נמצא בשרת.';
  if (member.id === interaction.guild.ownerId) return 'לא ניתן לבצע פעולת ניהול על בעל השרת.';
  if (member.id === interaction.user.id) return 'לא ניתן לבצע את הפעולה על עצמך.';
  if (member.id === interaction.client.user.id) return 'לא ניתן לבצע את הפעולה על EditIL Assistant.';
  if (member.roles.highest.position >= interaction.member.roles.highest.position
    && interaction.user.id !== interaction.guild.ownerId) return 'תפקיד החבר שווה או גבוה מהתפקיד הגבוה ביותר שלך.';
  if (member.roles.highest.position >= interaction.guild.members.me.roles.highest.position) return 'התפקיד של EditIL Assistant נמוך מדי בהיררכיית התפקידים.';
  return null;
}

function auditReason(interaction, reason) {
  return `${reason || 'לא צוינה סיבה'} | צוות: ${interaction.user.tag} (${interaction.user.id})`.slice(0, 512);
}

async function sendActionLog(interaction, eventType, action, target, reason, fields = []) {
  await logEvent({
    client: interaction.client,
    guildId: interaction.guildId,
    eventType,
    data: {
      title: `פעולת ניהול: ${action}`,
      userId: target?.id,
      channelId: interaction.channelId,
      description: target ? `${target} (\`${target.id}\`)` : undefined,
      fields: [
        { name: 'איש צוות', value: `${interaction.user} (\`${interaction.user.id}\`)`, inline: true },
        { name: 'סיבה', value: reason || 'לא צוינה סיבה', inline: false },
        ...fields,
      ],
    },
  });
}

async function manageChannelPermission(name, interaction, client) {
  const channel = interaction.options.getChannel('channel') || interaction.channel;
  if (!channel || channel.type !== ChannelType.GuildText) return respond(interaction, 'יש לבחור ערוץ טקסט תקין.', 'error');
  const isVisibility = name === 'hide' || name === 'unhide';
  const isRestore = name === 'unlock' || name === 'unhide';
  const permission = isVisibility ? PermissionFlagsBits.ViewChannel : PermissionFlagsBits.SendMessages;
  const property = isVisibility ? 'ViewChannel' : 'SendMessages';
  const stateName = isVisibility ? 'visibility' : 'lock';
  const key = `community:${interaction.guildId}:${stateName}:${channel.id}`;

  if (!isRestore) {
    if ((await client.db.get(key, null)) !== null) return respond(interaction, `הערוץ ${channel} כבר נמצא במצב המבוקש.`, 'warning');
    const overwrite = channel.permissionOverwrites.cache.get(interaction.guild.roles.everyone.id);
    const previous = overwrite?.allow.has(permission) ? true : overwrite?.deny.has(permission) ? false : null;
    await client.db.set(key, { previous, by: interaction.user.id, at: Date.now() });
    await channel.permissionOverwrites.edit(interaction.guild.roles.everyone, { [property]: false }, {
      reason: auditReason(interaction, isVisibility ? 'הסתרת ערוץ' : 'נעילת ערוץ'),
    });
    await sendActionLog(interaction, isVisibility ? 'channel.change' : 'moderation.lock', isVisibility ? 'הסתרת ערוץ' : 'נעילת ערוץ', null, 'לא צוינה סיבה', [
      { name: 'ערוץ', value: `${channel} (\`${channel.id}\`)`, inline: true },
    ]);
    return respond(interaction, isVisibility ? `${channel} הוסתר מחברי השרת.` : `${channel} ננעל לכתיבה.`);
  }

  const saved = await client.db.get(key, null);
  if (!saved) return respond(interaction, 'לא נמצא מצב הרשאות שמור לערוץ הזה.', 'warning');
  await channel.permissionOverwrites.edit(interaction.guild.roles.everyone, { [property]: saved.previous }, {
    reason: auditReason(interaction, isVisibility ? 'חשיפת ערוץ' : 'פתיחת ערוץ'),
  });
  await client.db.delete(key);
  await sendActionLog(interaction, isVisibility ? 'channel.change' : 'moderation.unlock', isVisibility ? 'חשיפת ערוץ' : 'פתיחת ערוץ', null, 'שחזור הרשאה קודמת', [
    { name: 'ערוץ', value: `${channel} (\`${channel.id}\`)`, inline: true },
  ]);
  return respond(interaction, `ההרשאה הקודמת של ${channel} שוחזרה.`);
}

async function manageRecords(name, interaction, client, user) {
  const warnings = name.includes('warning');
  const key = warnings ? warningKey(interaction.guildId, user.id) : NOTE_KEY(interaction.guildId, user.id);
  const records = await client.db.get(key, []);
  const isAdd = name === 'warn' || name === 'note';
  const isClear = name === 'clearwarnings' || name === 'clearnotes';
  const label = warnings ? 'אזהרה' : 'הערה';

  if (isAdd) {
    const reason = interaction.options.getString('reason') || 'לא צוינה הערה';
    const record = {
      id: `${warnings ? 'WRN' : 'NOTE'}-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`,
      reason,
      moderatorId: interaction.user.id,
      createdAt: Date.now(),
      active: true,
    };
    records.push(record);
    await client.db.set(key, records);
    if (warnings) {
      await user.send({
        embeds: [createEmbed({
          title: `⚠️ קיבלת אזהרה ב־${interaction.guild.name}`,
          description: `**סיבה:** ${reason}\n**מזהה:** \`${record.id}\``,
          color: 'warning',
        })],
        allowedMentions: { parse: [] },
      }).catch(() => null);
      await sendActionLog(interaction, 'moderation.warn', 'אזהרה', user, reason, [
        { name: 'מזהה', value: `\`${record.id}\``, inline: true },
      ]);
    }
    return respond(interaction, `${label} נוספה עבור ${user}.\nמזהה: \`${record.id}\`.`);
  }

  if (isClear) {
    const id = interaction.options.getString(warnings ? 'warning_id' : 'note_id');
    const active = records.filter(record => record.active !== false && (!id || record.id === id));
    if (!active.length) return respond(interaction, `לא נמצאה ${label} פעילה מתאימה.`, 'error');
    const next = records.map(record => (
      record.active !== false && (!id || record.id === id)
        ? { ...record, active: false, removedBy: interaction.user.id, removedAt: Date.now() }
        : record
    ));
    await client.db.set(key, next);
    return respond(interaction, id ? `${label} \`${id}\` הוסרה ונשמרה בהיסטוריה.` : `כל ה${warnings ? 'אזהרות' : 'הערות'} הפעילות הוסרו ונשמרו בהיסטוריה.`);
  }

  const visible = records.slice(-15).reverse();
  const lines = visible.map(record => `**${record.id || 'רשומה ישנה'}** — ${record.reason}\n<@${record.moderatorId}> · <t:${Math.floor(record.createdAt / 1000)}:f> · ${record.active === false ? 'הוסרה' : 'פעילה'}`);
  return interaction.reply({
    embeds: [createEmbed({
      title: `${warnings ? '⚠️ אזהרות' : '📝 הערות צוות'} — ${user.username}`,
      description: lines.join('\n\n') || `אין ${warnings ? 'אזהרות' : 'הערות צוות'}.`,
      color: warnings ? 'warning' : 'primary',
      footer: { text: records.length > 15 ? `מוצגות 15 הרשומות האחרונות מתוך ${records.length}` : `${records.length} רשומות` },
    })],
    flags: EPHEMERAL,
    allowedMentions: { parse: [] },
  });
}

async function executeCommand(name, interaction, client) {
  const definition = DEFINITIONS[name];
  if (!await requireAccess(interaction, client, definition.access ?? AccessLevel.MODERATOR)) return;
  if (definition.permission && !interaction.guild.members.me.permissions.has(definition.permission)) {
    return respond(interaction, 'ל־EditIL Assistant חסרה ההרשאה הדרושה לביצוע הפעולה.', 'error');
  }
  const reason = interaction.options.getString('reason') || 'לא צוינה סיבה';

  if (['lock', 'unlock', 'hide', 'unhide'].includes(name)) return manageChannelPermission(name, interaction, client);
  if (name === 'slowmode') {
    const channel = interaction.options.getChannel('channel') || interaction.channel;
    if (!channel || channel.type !== ChannelType.GuildText) return respond(interaction, 'יש לבחור ערוץ טקסט תקין.', 'error');
    const seconds = interaction.options.getInteger('seconds');
    await channel.setRateLimitPerUser(seconds, auditReason(interaction, 'שינוי מצב איטי'));
    await sendActionLog(interaction, 'channel.change', 'שינוי מצב איטי', null, 'לא צוינה סיבה', [
      { name: 'ערוץ', value: `${channel} (\`${channel.id}\`)`, inline: true },
      { name: 'זמן', value: seconds ? `${seconds} שניות` : 'מבוטל', inline: true },
    ]);
    return respond(interaction, seconds ? `מצב איטי של **${seconds} שניות** הופעל ב־${channel}.` : `מצב איטי בוטל ב־${channel}.`);
  }
  if (name === 'clear') {
    const amount = interaction.options.getInteger('amount');
    const selectedUser = interaction.options.getUser('member');
    const type = interaction.options.getString('type') || 'all';
    const contains = interaction.options.getString('contains')?.toLowerCase();
    const fetched = await interaction.channel.messages.fetch({ limit: 100 });
    const selected = fetched.filter(message => {
      if (message.pinned) return false;
      if (selectedUser && message.author.id !== selectedUser.id) return false;
      if (contains && !message.content.toLowerCase().includes(contains)) return false;
      if (type === 'bots' && !message.author.bot) return false;
      if (type === 'links' && !/https?:\/\/\S+/i.test(message.content)) return false;
      if (type === 'attachments' && message.attachments.size === 0) return false;
      return true;
    }).first(amount);
    if (!selected.length) return respond(interaction, 'לא נמצאו הודעות שמתאימות למסננים.', 'warning');
    const deleted = await interaction.channel.bulkDelete(selected, true);
    await sendActionLog(interaction, 'moderation.purge', 'מחיקת הודעות', selectedUser, 'ניקוי ערוץ', [
      { name: 'ערוץ', value: `${interaction.channel} (\`${interaction.channelId}\`)`, inline: true },
      { name: 'כמות', value: String(deleted.size), inline: true },
      { name: 'מסנן', value: type, inline: true },
    ]);
    return respond(interaction, `נמחקו **${deleted.size}** הודעות.`);
  }
  if (name === 'unban') {
    const id = interaction.options.getString('user_id');
    if (!/^\d{17,20}$/.test(id)) return respond(interaction, 'מזהה המשתמש אינו תקין.', 'error');
    const ban = await interaction.guild.bans.fetch(id).catch(() => null);
    if (!ban) return respond(interaction, 'המשתמש אינו חסום בשרת.', 'warning');
    await interaction.guild.members.unban(id, auditReason(interaction, reason));
    await sendActionLog(interaction, 'moderation.unban', 'הסרת חסימה', ban.user, reason);
    return respond(interaction, `החסימה של ${ban.user} הוסרה.\n**סיבה:** ${reason}`);
  }

  const user = interaction.options.getUser('member');
  if (['warn', 'warnings', 'clearwarnings', 'note', 'notes', 'clearnotes'].includes(name)) {
    return manageRecords(name, interaction, client, user);
  }
  const member = await interaction.guild.members.fetch(user.id).catch(() => null);
  const error = targetError(interaction, member);
  if (error) return respond(interaction, error, 'error');
  const audit = auditReason(interaction, reason);

  if (name === 'ban' || name === 'softban') {
    const hours = interaction.options.getInteger('delete_messages') ?? (name === 'softban' ? 24 : 0);
    await user.send(`נחסמת בשרת ${interaction.guild.name}.\nסיבה: ${reason}`).catch(() => null);
    await member.ban({ reason: audit, deleteMessageSeconds: hours * 3600 });
    if (name === 'softban') await interaction.guild.members.unban(user.id, auditReason(interaction, 'Softban — הסרה מיידית'));
    await sendActionLog(interaction, 'moderation.ban', name === 'softban' ? 'חסימה רכה' : 'חסימה', user, reason, [
      { name: 'מחיקת הודעות', value: `${hours} שעות`, inline: true },
    ]);
    return respond(interaction, name === 'softban'
      ? `${user} עבר חסימה רכה ויכול להצטרף מחדש.\n**סיבה:** ${reason}`
      : `${user} נחסם מהשרת.\n**סיבה:** ${reason}`);
  }
  if (name === 'kick') {
    await user.send(`הוסרת מהשרת ${interaction.guild.name}.\nסיבה: ${reason}`).catch(() => null);
    await member.kick(audit);
    await sendActionLog(interaction, 'moderation.kick', 'הוצאה מהשרת', user, reason);
    return respond(interaction, `${user} הוסר מהשרת.\n**סיבה:** ${reason}`);
  }
  if (name === 'timeout') {
    const duration = parseModerationDuration(interaction.options.getString('duration'));
    if (!duration) return respond(interaction, 'משך הזמן אינו תקין. השתמשו למשל ב־`10m`, `2h`, `1d` או `1h30m` (עד 28 ימים).', 'error');
    await user.send(`הושתקת זמנית בשרת ${interaction.guild.name}.\nסיבה: ${reason}`).catch(() => null);
    await member.timeout(duration, audit);
    await sendActionLog(interaction, 'moderation.mute', 'השתקה זמנית', user, reason, [
      { name: 'משך', value: `<t:${Math.floor((Date.now() + duration) / 1000)}:R>`, inline: true },
    ]);
    return respond(interaction, `${user} הושתק עד <t:${Math.floor((Date.now() + duration) / 1000)}:F>.\n**סיבה:** ${reason}`);
  }
  if (name === 'untimeout') {
    if (!member.communicationDisabledUntilTimestamp) return respond(interaction, `${user} אינו מושתק כרגע.`, 'warning');
    await member.timeout(null, audit);
    await sendActionLog(interaction, 'moderation.mute', 'הסרת השתקה', user, reason);
    return respond(interaction, `ההשתקה של ${user} הוסרה.`);
  }
  if (name === 'nick') {
    const nickname = interaction.options.getString('nickname');
    await member.setNickname(nickname, auditReason(interaction, nickname ? 'שינוי כינוי' : 'איפוס כינוי'));
    await sendActionLog(interaction, 'member.namechange', nickname ? 'שינוי כינוי' : 'איפוס כינוי', user, reason, [
      { name: 'כינוי חדש', value: nickname || 'ברירת המחדל', inline: true },
    ]);
    return respond(interaction, nickname ? `הכינוי של ${user} שונה ל־**${nickname}**.` : `הכינוי של ${user} אופס לברירת המחדל.`);
  }
  if (name === 'voicekick') {
    if (!member.voice.channelId) return respond(interaction, `${user} אינו מחובר לערוץ קולי.`, 'warning');
    const previousChannel = member.voice.channelId;
    await member.voice.disconnect(audit);
    await sendActionLog(interaction, 'voice.change', 'ניתוק מערוץ קולי', user, reason, [
      { name: 'ערוץ קודם', value: `<#${previousChannel}>`, inline: true },
    ]);
    return respond(interaction, `${user} נותק מהערוץ הקולי.`);
  }
  return respond(interaction, 'הפעולה אינה זמינה.', 'error');
}

export function moderationCommand(name) {
  return {
    data: buildData(name),
    async execute(interaction, client) {
      try {
        return await executeCommand(name, interaction, client);
      } catch (error) {
        logger.error('Moderation command failed', {
          command: name,
          guildId: interaction.guildId,
          userId: interaction.user?.id,
          error: error.stack || error.message,
        });
        return respond(interaction, 'אירעה שגיאה בביצוע הפעולה. בדקו את הרשאות הבוט ואת היררכיית התפקידים.', 'error');
      }
    },
  };
}
