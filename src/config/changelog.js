export const changelog = [
    {
        version: '2.2.0',
        date: '2026-05-01',
        entries: [
            { type: 'new',     text: 'Added `/joke` — get a random joke (pun, programming, dark, misc)' },
            { type: 'new',     text: 'Added `/meme` — get a random meme from Reddit' },
            { type: 'new',     text: 'Added `/quote` — get a random inspirational quote' },
            { type: 'new',     text: 'Added `/github` — look up any GitHub user or repository' },
            { type: 'removed', text: 'Removed economy system (balance, shop, daily, gamble, etc.)' },
        ],
    },
    {
        version: '2.1.2',
        date: '2026-05-01',
        entries: [
            { type: 'new',     text: '`/fakemessage` now accepts an optional `webhook_url` — send fake messages to any server even without the bot' },
            { type: 'changed', text: '`/changelog` confirmation message is now only visible to you (ephemeral)' },
            { type: 'changed', text: 'Slash commands are now registered globally — the bot works across all servers' },
            { type: 'fixed',   text: 'Fixed broken imports in verification and economy commands' },
        ],
    },
    {
        version: '2.1.1',
        date: '2026-05-01',
        entries: [
            { type: 'new',     text: 'Added `/changelog` — post the bot changelog to any channel (admin only)' },
        ],
    },
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
