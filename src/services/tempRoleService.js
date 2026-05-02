import { logger } from '../utils/logger.js';
import { randomUUID } from 'crypto';

function getKey(guildId) {
    return `guild:${guildId}:temproles`;
}

export const TempRoleService = {
    async list(client, guildId) {
        return client.db.get(getKey(guildId), []);
    },

    async add(client, guildId, { userId, roleId, expiresAt, assignedBy }) {
        const entries = await client.db.get(getKey(guildId), []);
        const filtered = entries.filter(e => !(e.userId === userId && e.roleId === roleId));
        filtered.push({
            id: randomUUID().slice(0, 8),
            userId,
            roleId,
            expiresAt,
            assignedBy,
            assignedAt: Date.now(),
        });
        await client.db.set(getKey(guildId), filtered);
        return { success: true };
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

export async function checkTempRoles(client) {
    const now = Date.now();
    for (const [guildId, guild] of client.guilds.cache) {
        try {
            const entries = await client.db.get(`guild:${guildId}:temproles`, []);
            const expired = entries.filter(e => e.expiresAt <= now);
            if (!expired.length) continue;

            for (const entry of expired) {
                try {
                    const member = await guild.members.fetch(entry.userId).catch(() => null);
                    if (member && member.roles.cache.has(entry.roleId)) {
                        await member.roles.remove(entry.roleId, 'Temp role expired');
                        logger.info(`Temp role ${entry.roleId} expired for ${entry.userId} in ${guildId}`);
                    }
                } catch (err) {
                    logger.error(`Failed to remove temp role ${entry.roleId} from ${entry.userId}:`, err);
                }
                await TempRoleService.removeById(client, guildId, entry.id);
            }
        } catch (error) {
            logger.error(`Temp role check error for guild ${guildId}:`, error);
        }
    }
}
