import { logger } from '../utils/logger.js';
import { randomUUID } from 'crypto';

// setTimeout max is ~24.8 days (2^31 ms); rely on cron for longer durations
const MAX_SETTIMEOUT_MS = 24 * 24 * 60 * 60 * 1000;

function getKey(guildId) {
    return `guild:${guildId}:temproles`;
}

async function expireEntry(client, guildId, entry) {
    try {
        const guild = client.guilds.cache.get(guildId);
        if (guild) {
            const member = await guild.members.fetch(entry.userId).catch(() => null);
            if (member && member.roles.cache.has(entry.roleId)) {
                await member.roles.remove(entry.roleId, 'Temp role expired');
                logger.info(`Temp role ${entry.roleId} expired for ${entry.userId} in ${guildId}`);
            }
        }
    } catch (err) {
        logger.error(`Failed to remove temp role ${entry.roleId} from ${entry.userId}:`, err);
    }
    await TempRoleService.removeById(client, guildId, entry.id);
}

export function scheduleTempRoleRemoval(client, guildId, entry) {
    const delay = entry.expiresAt - Date.now();
    if (delay <= 0) {
        expireEntry(client, guildId, entry);
        return;
    }
    if (delay <= MAX_SETTIMEOUT_MS) {
        setTimeout(() => expireEntry(client, guildId, entry), delay);
    }
    // else: cron job handles it (fires every minute)
}

export const TempRoleService = {
    async list(client, guildId) {
        return client.db.get(getKey(guildId), []);
    },

    async add(client, guildId, { userId, roleId, expiresAt, assignedBy }) {
        const entries = await client.db.get(getKey(guildId), []);
        const filtered = entries.filter(e => !(e.userId === userId && e.roleId === roleId));
        const entry = {
            id: randomUUID().slice(0, 8),
            userId,
            roleId,
            expiresAt,
            assignedBy,
            assignedAt: Date.now(),
        };
        filtered.push(entry);
        await client.db.set(getKey(guildId), filtered);
        return { success: true, entry };
    },

    async remove(client, guildId, userId, roleId) {
        const entries = await client.db.get(getKey(guildId), []);
        const idx = entries.findIndex(e => e.userId === userId && e.roleId === roleId);
        if (idx === -1) return { success: false };
        entries.splice(idx, 1);
        await client.db.set(getKey(guildId), entries);
        return { success: true };
    },

    async removeById(client, guildId, id) {
        const entries = await client.db.get(getKey(guildId), []);
        await client.db.set(getKey(guildId), entries.filter(e => e.id !== id));
    },
};

// Called on bot ready to reschedule any temp roles that survived a restart
export async function loadAndScheduleTempRoles(client) {
    for (const [guildId] of client.guilds.cache) {
        try {
            const entries = await client.db.get(getKey(guildId), []);
            for (const entry of entries) {
                scheduleTempRoleRemoval(client, guildId, entry);
            }
            if (entries.length) {
                logger.info(`Scheduled ${entries.length} temp role(s) for guild ${guildId}`);
            }
        } catch (err) {
            logger.error(`Failed to load temp roles for guild ${guildId}:`, err);
        }
    }
}

// Cron fallback — catches anything setTimeout missed (e.g. > 24-day durations)
export async function checkTempRoles(client) {
    const now = Date.now();
    for (const [guildId, guild] of client.guilds.cache) {
        try {
            const entries = await client.db.get(getKey(guildId), []);
            const expired = entries.filter(e => e.expiresAt <= now);
            if (!expired.length) continue;

            for (const entry of expired) {
                try {
                    const member = await guild.members.fetch(entry.userId).catch(() => null);
                    if (member && member.roles.cache.has(entry.roleId)) {
                        await member.roles.remove(entry.roleId, 'Temp role expired');
                        logger.info(`Temp role ${entry.roleId} expired (cron) for ${entry.userId} in ${guildId}`);
                    }
                } catch (err) {
                    logger.error(`Failed to remove temp role ${entry.roleId} from ${entry.userId}:`, err);
                }
                await TempRoleService.removeById(client, guildId, entry.id);
            }
        } catch (error) {
            logger.error(`Temp role cron check error for guild ${guildId}:`, error);
        }
    }
}
