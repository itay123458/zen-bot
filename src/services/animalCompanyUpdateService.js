import { EmbedBuilder, PermissionFlagsBits } from 'discord.js';
import { logger } from '../utils/logger.js';

export const ANIMAL_COMPANY_APP_ID = '4551040';
export const ANIMAL_COMPANY_GUILD_ID = '1502383010656288949';
export const ANIMAL_COMPANY_CHANNEL_ID = '1502388916895088740';
export const ANIMAL_COMPANY_NEWS_URL = `https://api.steampowered.com/ISteamNews/GetNewsForApp/v2/?appid=${ANIMAL_COMPANY_APP_ID}&count=10&maxlength=10000&format=json`;
export const ANIMAL_COMPANY_STORE_URL = `https://store.steampowered.com/app/${ANIMAL_COMPANY_APP_ID}/Animal_Company/`;
export const ANIMAL_COMPANY_THUMBNAIL_URL = 'https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/4551040/8b86cf67d63d6bda4c71209070e0ff866d8e6bfe/capsule_616x353.jpg';
export const ANIMAL_COMPANY_POLL_INTERVAL_MS = 15 * 60 * 1000;
export const ANIMAL_COMPANY_QUEST_URL = 'https://queststoredb.com/game/animal-company-7190422614401072/';

const STATE_KEY = 'animal_company:update_tracker';
const categoryRules = [
  ['New items', /\b(item|weapon|gear|cosmetic|skin|hat|animal|coin|reward|tool|toy)\b/i],
  ['Maps & areas', /\b(map|area|zone|forest|mine|lab|cave|moon|arena)\b/i],
  ['Events & quests', /\b(event|quest|challenge|season|contest)\b/i],
  ['Gameplay changes', /\b(gameplay|mode|feature|added|new|changed|improved)\b/i],
  ['Fixes', /\b(fix|fixed|bug|crash|performance|issue)\b/i],
];

function decodeEntities(value) {
  return value.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&nbsp;/g, ' ');
}

export function releaseNoteLines(contents = '') {
  const text = decodeEntities(String(contents)).replace(/\[img\].*?\[\/img\]/gis, ' ')
    .replace(/\[url=[^\]]+\](.*?)\[\/url\]/gis, '$1').replace(/\[(?:\/?)(?:b|i|u|h\d|list|\*)\]/gi, '\n')
    .replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]+>/g, ' ');
  return text.split(/\r?\n|[•●]/).map(line => line.replace(/\s+/g, ' ').trim())
    .filter(line => line.length >= 3 && line.length <= 300).slice(0, 40);
}

export function categorizeReleaseNotes(contents) {
  const result = Object.fromEntries(categoryRules.map(([name]) => [name, []]));
  const other = [];
  for (const line of releaseNoteLines(contents)) {
    const category = categoryRules.find(([, rule]) => rule.test(line));
    (category ? result[category[0]] : other).push(line);
  }
  if (other.length) result['Other changes'] = other;
  return Object.fromEntries(Object.entries(result).filter(([, lines]) => lines.length));
}

export async function fetchAnimalCompanyUpdates(fetchImpl = globalThis.fetch) {
  const response = await fetchImpl(ANIMAL_COMPANY_NEWS_URL, { signal: AbortSignal.timeout(15_000) });
  if (!response.ok) throw new Error(`Steam news request failed with HTTP ${response.status}`);
  const json = await response.json();
  return (json?.appnews?.newsitems || []).filter(item => item?.gid && item?.title)
    .sort((a, b) => Number(a.date) - Number(b.date));
}

export async function fetchAnimalCompanyLiveBuild(fetchImpl = globalThis.fetch) {
  const response = await fetchImpl(ANIMAL_COMPANY_QUEST_URL, { signal: AbortSignal.timeout(15_000) });
  if (!response.ok) throw new Error(`Quest live-build request failed with HTTP ${response.status}`);
  const html = await response.text();
  const version = html.match(/"(?:softwareVersion|Version)"\s*:\s*"([^"]+)"/i)?.[1]
    || html.match(/app version<\/td>\s*<td[^>]*>([^<]+)<\/td>/i)?.[1]?.trim();
  if (!version || !/^\d+(?:\.\d+){2,3}$/.test(version)) throw new Error('Quest live-build response did not contain a valid version');
  return { version, checkedAt: new Date() };
}

export function extractAnimalCompanyVersion(item) {
  const text = `${item?.title || ''}\n${item?.contents || ''}`;
  return text.match(/\b\d+\.\d+(?:\.\d+){0,2}\b/)?.[0] || item?.title || 'Unknown';
}

export function buildAnimalCompanyEmbed(item, checkedAt = new Date()) {
  const buildTimestamp = Math.floor(Number(item.date) || checkedAt.getTime() / 1000);
  const version = extractAnimalCompanyVersion(item);
  return new EmbedBuilder()
    .setColor(0xed1c24)
    .setAuthor({ name: 'AMB Tracker X' })
    .setTitle('New Developer Build')
    .setURL(item.url || ANIMAL_COMPANY_STORE_URL)
    .setThumbnail(ANIMAL_COMPANY_THUMBNAIL_URL)
    .addFields(
      { name: '🟢 Updated Version:', value: `\`\`\`\n${version}\n\`\`\`` },
      { name: '⏱️ Time of Dev Build:', value: `(<t:${buildTimestamp}:R>) <t:${buildTimestamp}:F>` },
    )
    .setFooter({ text: `Checked at ${checkedAt.toISOString()}` })
    .setTimestamp(checkedAt);
}

export function buildAnimalCompanyLiveEmbed({ version, previousVersion, releasedAt, checkedAt = new Date(), devBuildCount = 0 }) {
  const releaseTimestamp = Math.floor(new Date(releasedAt).getTime() / 1000);
  return new EmbedBuilder()
    .setColor(0xed1c24)
    .setAuthor({ name: 'AMB Tracker X' })
    .setTitle('Update Detected')
    .setDescription('**LIVE Build**')
    .setURL(ANIMAL_COMPANY_QUEST_URL)
    .addFields(
      { name: '🟢 Updated Version:', value: `\`\`\`\n${version}\n\`\`\`` },
      { name: '🔴 Last Logged:', value: `\`\`\`\n${previousVersion || 'Unknown'}\n\`\`\`` },
      { name: '⏱️ Time of Live Release:', value: `(<t:${releaseTimestamp}:R>) <t:${releaseTimestamp}:F>`, inline: true },
      { name: '🔨 Dev Builds Before Release:', value: `\`${devBuildCount}\` dev builds`, inline: true },
    )
    .setImage(ANIMAL_COMPANY_THUMBNAIL_URL)
    .setFooter({ text: `Checked at ${checkedAt.toISOString()}` })
    .setTimestamp(checkedAt);
}

async function resolveTargetChannel(client) {
  const guild = await client.guilds.fetch(ANIMAL_COMPANY_GUILD_ID).catch(() => null);
  if (!guild) return null;
  const channel = await guild.channels.fetch(ANIMAL_COMPANY_CHANNEL_ID).catch(() => null);
  if (!channel?.isTextBased()) return null;
  const permissions = channel.permissionsFor(guild.members.me);
  if (!permissions?.has([PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.EmbedLinks])) return null;
  return channel;
}

export async function checkAnimalCompanyUpdates(client, { force = false } = {}) {
  if (!client.db?.isAvailable()) return { ok: false, code: 'database_unavailable', posted: 0 };
  const channel = await resolveTargetChannel(client);
  if (!channel) return { ok: false, code: 'target_unavailable', posted: 0 };
  const state = await client.db.get(STATE_KEY, { seenIds: [], initialized: false });
  const live = await fetchAnimalCompanyLiveBuild();
  if (!state.initialized && !force) {
    await client.db.set(STATE_KEY, { ...state, initialized: true, liveVersion: live.version, liveReleasedAt: live.checkedAt.toISOString(), devBuildsSinceLive: state.devBuildsSinceLive || [], lastCheckedAt: live.checkedAt.toISOString() });
    return { ok: true, initialized: true, posted: 0 };
  }
  let posted = 0;
  if (state.liveVersion && state.liveVersion !== live.version) {
    await channel.send({ embeds: [buildAnimalCompanyLiveEmbed({ version: live.version, previousVersion: state.liveVersion, releasedAt: live.checkedAt, checkedAt: live.checkedAt, devBuildCount: state.devBuildsSinceLive?.length || 0 })], allowedMentions: { parse: [] } });
    posted += 1;
  }
  await client.db.set(STATE_KEY, { ...state, initialized: true, liveVersion: live.version, liveReleasedAt: state.liveVersion === live.version ? state.liveReleasedAt : live.checkedAt.toISOString(), previousLiveVersion: state.liveVersion !== live.version ? state.liveVersion : state.previousLiveVersion, devBuildsSinceLive: state.liveVersion !== live.version ? [] : state.devBuildsSinceLive || [], lastCheckedAt: live.checkedAt.toISOString(), lastPostAt: posted ? live.checkedAt.toISOString() : state.lastPostAt || null });
  return { ok: true, posted, liveVersion: live.version };
}

export async function recordAnimalCompanyDevBuild(client, version, recordedAt = new Date()) {
  if (!client.db?.isAvailable()) return { ok: false, code: 'database_unavailable' };
  const channel = await resolveTargetChannel(client);
  if (!channel) return { ok: false, code: 'target_unavailable' };
  const state = await client.db.get(STATE_KEY, { initialized: false, devBuildsSinceLive: [] });
  if (state.devBuildsSinceLive?.at(-1)?.version === version) return { ok: true, duplicate: true, version };
  const item = { title: version, contents: '', date: Math.floor(recordedAt.getTime() / 1000), url: ANIMAL_COMPANY_QUEST_URL };
  const message = await channel.send({ embeds: [buildAnimalCompanyEmbed(item, recordedAt)], allowedMentions: { parse: [] } });
  const devBuildsSinceLive = [...(state.devBuildsSinceLive || []), { version, recordedAt: recordedAt.toISOString(), messageId: message.id }].slice(-100);
  await client.db.set(STATE_KEY, { ...state, initialized: true, devBuildsSinceLive, lastDevVersion: version, lastPostAt: recordedAt.toISOString(), lastCheckedAt: state.lastCheckedAt || recordedAt.toISOString() });
  return { ok: true, version, messageId: message.id };
}

export async function getAnimalCompanyTrackerStatus(client) {
  return client.db.get(STATE_KEY, { initialized: false, liveVersion: null, previousLiveVersion: null, lastDevVersion: null, devBuildsSinceLive: [], lastCheckedAt: null, lastPostAt: null });
}

export function startAnimalCompanyTracker(client) {
  if (client.animalCompanyTimer) clearInterval(client.animalCompanyTimer);
  const run = () => checkAnimalCompanyUpdates(client).catch(error => logger.error('Animal Company tracker failed', { error: error.stack || error.message }));
  void run();
  client.animalCompanyTimer = setInterval(run, ANIMAL_COMPANY_POLL_INTERVAL_MS);
  client.animalCompanyTimer.unref?.();
}
