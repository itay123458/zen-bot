import { logger } from '../utils/logger.js';
import { randomUUID } from 'crypto';

const MAX_TRIGGERS = 50;

function getKey(guildId) {
    return `guild:${guildId}:autoresponder`;
}

export const AutoresponderService = {
    async list(client, guildId) {
        return client.db.get(getKey(guildId), []);
    },

    async add(client, guildId, { trigger, response, matchType, createdBy }) {
        const triggers = await client.db.get(getKey(guildId), []);

        if (triggers.length >= MAX_TRIGGERS) {
            return { success: false, error: `Maximum of ${MAX_TRIGGERS} autoresponders reached.` };
        }

        if (triggers.find(t => t.trigger === trigger)) {
            return { success: false, error: `A trigger for \`${trigger}\` already exists. Remove it first.` };
        }

        const id = randomUUID().slice(0, 8);
        triggers.push({ id, trigger, response, matchType, createdBy, createdAt: Date.now() });
        await client.db.set(getKey(guildId), triggers);
        return { success: true, id };
    },

    async remove(client, guildId, trigger) {
        const triggers = await client.db.get(getKey(guildId), []);
        const idx = triggers.findIndex(t => t.trigger === trigger || t.id === trigger);
        if (idx === -1) return { success: false };
        triggers.splice(idx, 1);
        await client.db.set(getKey(guildId), triggers);
        return { success: true };
    },

    async clear(client, guildId) {
        await client.db.set(getKey(guildId), []);
    },

    async check(client, message) {
        if (!message.guild) return;
        try {
            const triggers = await client.db.get(getKey(message.guild.id), []);
            if (!triggers.length) return;

            const content = message.content.toLowerCase();

            for (const t of triggers) {
                let matched = false;
                switch (t.matchType) {
                    case 'exact':
                        matched = content === t.trigger;
                        break;
                    case 'startswith':
                        matched = content.startsWith(t.trigger);
                        break;
                    case 'contains':
                    default:
                        matched = content.includes(t.trigger);
                }

                if (matched) {
                    const response = t.response.replace(/\{user\}/gi, `<@${message.author.id}>`);
                    await message.channel.send(response).catch(err =>
                        logger.error('Autoresponder send error:', err)
                    );
                    return;
                }
            }
        } catch (err) {
            logger.error('Autoresponder check error:', err);
        }
    },
};
