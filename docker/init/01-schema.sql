-- Create rss schema if it doesn't exist
CREATE SCHEMA IF NOT EXISTS rss;

-- Table for storing RSS feed sources
CREATE TABLE IF NOT EXISTS rss.feeds (
    id SERIAL PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    url VARCHAR(2048) NOT NULL UNIQUE,
    description TEXT,
    language VARCHAR(10), -- e.g., 'en', 'fr'
    category VARCHAR(100),
    last_fetched TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    active BOOLEAN DEFAULT true
);

-- Table for storing individual RSS items/articles
CREATE TABLE IF NOT EXISTS rss.items (
    id SERIAL PRIMARY KEY,
    feed_id INTEGER NOT NULL REFERENCES rss.feeds(id) ON DELETE CASCADE,
    guid VARCHAR(1024) UNIQUE NOT NULL, -- Use GUID or link as unique identifier
    title TEXT,
    link VARCHAR(2048),
    description TEXT,
    content TEXT, -- Full content if available
    author VARCHAR(255),
    published_date TIMESTAMP WITH TIME ZONE,
    categories TEXT[], -- Array of category strings
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    is_read BOOLEAN DEFAULT false,
    is_bookmarked BOOLEAN DEFAULT false
);

-- Table for storing AI-generated summaries
CREATE TABLE IF NOT EXISTS rss.summaries (
    id SERIAL PRIMARY KEY,
    item_id INTEGER NOT NULL REFERENCES rss.items(id) ON DELETE CASCADE,
    summary_text TEXT NOT NULL,
    language VARCHAR(10), -- Language of the summary
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Table for storing podcast versions generated with ElevenLabs
CREATE TABLE IF NOT EXISTS rss.podcasts (
    id SERIAL PRIMARY KEY,
    item_id INTEGER NOT NULL REFERENCES rss.items(id) ON DELETE CASCADE,
    summary_id INTEGER REFERENCES rss.summaries(id) ON DELETE SET NULL, -- Link to the summary used
    audio_file_path VARCHAR(1024) NOT NULL, -- Path relative to public directory or storage URL
    duration INTEGER, -- Duration in seconds (optional, can be estimated or calculated)
    voice_id VARCHAR(100), -- ElevenLabs voice ID used
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_items_feed_id ON rss.items(feed_id);
CREATE INDEX IF NOT EXISTS idx_items_published_date ON rss.items(published_date);
CREATE INDEX IF NOT EXISTS idx_summaries_item_id ON rss.summaries(item_id);
CREATE INDEX IF NOT EXISTS idx_podcasts_item_id ON rss.podcasts(item_id);
CREATE INDEX IF NOT EXISTS idx_podcasts_summary_id ON rss.podcasts(summary_id);
CREATE INDEX IF NOT EXISTS idx_items_guid ON rss.items(guid); -- Index GUID for faster checking

-- Function to automatically update the 'updated_at' timestamp
CREATE OR REPLACE FUNCTION trigger_set_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for rss.feeds table
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'set_timestamp_feeds') THEN
        CREATE TRIGGER set_timestamp_feeds
        BEFORE UPDATE ON rss.feeds
        FOR EACH ROW
        EXECUTE FUNCTION trigger_set_timestamp();
    END IF;
END
$$;

-- Add some initial feed data if needed (example)
-- INSERT INTO rss.feeds (title, url, description, language, category, active) VALUES
-- ('Phys.org Quantum Physics', 'https://phys.org/rss-feed/quantum-physics-news/', 'Latest news on quantum physics from Phys.org', 'en', 'Quantum Physics', true)
-- ON CONFLICT (url) DO NOTHING; -- Avoid inserting duplicates if script runs multiple times
