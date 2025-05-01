-- Create schema for rss feeds
CREATE SCHEMA IF NOT EXISTS rss;

-- Create tables for RSS feeds
CREATE TABLE IF NOT EXISTS rss.feeds (
    id SERIAL PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    url VARCHAR(500) NOT NULL UNIQUE,
    description TEXT,
    language VARCHAR(50),
    category VARCHAR(100),
    last_fetched TIMESTAMP,
    active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create table for feed items
CREATE TABLE IF NOT EXISTS rss.items (
    id SERIAL PRIMARY KEY,
    feed_id INTEGER REFERENCES rss.feeds(id) ON DELETE CASCADE,
    guid VARCHAR(500) NOT NULL,
    title VARCHAR(500) NOT NULL,
    link VARCHAR(1000),
    description TEXT,
    content TEXT,
    author VARCHAR(255),
    published_date TIMESTAMP,
    categories TEXT[],
    is_read BOOLEAN DEFAULT FALSE,
    is_bookmarked BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(feed_id, guid)
);

-- Create table for AI summaries
CREATE TABLE IF NOT EXISTS rss.summaries (
    id SERIAL PRIMARY KEY,
    item_id INTEGER REFERENCES rss.items(id) ON DELETE CASCADE,
    summary_text TEXT NOT NULL,
    language VARCHAR(50) DEFAULT 'en',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create table for podcast versions
CREATE TABLE IF NOT EXISTS rss.podcasts (
    id SERIAL PRIMARY KEY,
    item_id INTEGER REFERENCES rss.items(id) ON DELETE CASCADE,
    summary_id INTEGER REFERENCES rss.summaries(id) ON DELETE SET NULL,
    audio_file_path VARCHAR(1000),
    duration INTEGER, -- duration in seconds
    voice_id VARCHAR(100),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_items_feed_id ON rss.items(feed_id);
CREATE INDEX IF NOT EXISTS idx_items_published_date ON rss.items(published_date);
CREATE INDEX IF NOT EXISTS idx_summaries_item_id ON rss.summaries(item_id);
CREATE INDEX IF NOT EXISTS idx_podcasts_item_id ON rss.podcasts(item_id);
CREATE INDEX IF NOT EXISTS idx_podcasts_summary_id ON rss.podcasts(summary_id);

-- Function to update updated_at automatically
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for updated_at
CREATE TRIGGER update_feeds_updated_at
BEFORE UPDATE ON rss.feeds
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_items_updated_at
BEFORE UPDATE ON rss.items
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_summaries_updated_at
BEFORE UPDATE ON rss.summaries
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_podcasts_updated_at
BEFORE UPDATE ON rss.podcasts
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();
