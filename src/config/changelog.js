export const changelog = [
    {
        version: '2.1.0',
        date: '2026-05-01',
        entries: [
            { type: 'new',     text: 'Added `/avatar` — view a user\'s full-size avatar' },
            { type: 'new',     text: 'Added `/userinfo` — view detailed user information' },
            { type: 'new',     text: 'Added `/serverinfo` — view server information' },
            { type: 'new',     text: 'Added `/slowmode` — set channel slowmode (mods only)' },
            { type: 'new',     text: 'Added `/fakemessage` — send a message as another user (admin only)' },
            { type: 'changed', text: '`/purge` now shows a popup dialog asking how many messages to delete' },
            { type: 'changed', text: 'Bot renamed to **itay100k bot**' },
            { type: 'removed', text: 'Removed birthday commands' },
        ],
    },
    {
        version: '2.0.0',
        date: '2026-04-01',
        entries: [
            { type: 'new',     text: 'Initial release of the customized bot for the server' },
            { type: 'new',     text: 'Economy system with coins, shop, gambling, and more' },
            { type: 'new',     text: 'Leveling system with leaderboard' },
            { type: 'new',     text: 'Moderation suite: ban, kick, warn, timeout, purge, and more' },
            { type: 'new',     text: 'Ticket system with priority and claiming' },
            { type: 'new',     text: 'Giveaway system' },
            { type: 'new',     text: 'Reaction roles, logging, and server stats' },
        ],
    },
];

// Emoji prefix per entry type
export const typeEmoji = {
    new:     '🆕',
    changed: '✏️',
    fixed:   '🐛',
    removed: '🗑️',
};
