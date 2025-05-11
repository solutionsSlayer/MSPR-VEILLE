-- Create table to track items sent to Telegram
CREATE TABLE IF NOT EXISTS rss.telegram_sent (
    id SERIAL PRIMARY KEY,
    item_id INTEGER NOT NULL REFERENCES rss.items(id) ON DELETE CASCADE,
    summary_id INTEGER REFERENCES rss.summaries(id) ON DELETE SET NULL,
    podcast_id INTEGER REFERENCES rss.podcasts(id) ON DELETE SET NULL,
    type VARCHAR(10) NOT NULL, -- 'summary' or 'podcast'
    sent_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Add unique constraints to prevent duplicate sends
CREATE UNIQUE INDEX IF NOT EXISTS idx_telegram_unique_summary ON rss.telegram_sent (summary_id, type) WHERE type = 'summary' AND summary_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_telegram_unique_podcast ON rss.telegram_sent (podcast_id, type) WHERE type = 'podcast' AND podcast_id IS NOT NULL;

-- Indexes for better performance
CREATE INDEX IF NOT EXISTS idx_telegram_sent_summary_id ON rss.telegram_sent(summary_id);
CREATE INDEX IF NOT EXISTS idx_telegram_sent_podcast_id ON rss.telegram_sent(podcast_id);
CREATE INDEX IF NOT EXISTS idx_telegram_sent_item_id ON rss.telegram_sent(item_id);
