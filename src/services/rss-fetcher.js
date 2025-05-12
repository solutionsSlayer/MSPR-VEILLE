/**
 * Simple RSS Fetcher Service
 * Standalone service that fetches RSS feeds and stores them in the database
 */

const { Pool } = require('pg');
const Parser = require('rss-parser');
require('dotenv').config();

// Configuration
const DATABASE_URL = process.env.DATABASE_URL;

// Initialize DB connection
const pool = new Pool({ connectionString: DATABASE_URL });

// Initialize RSS parser
const rssParser = new Parser({
  customFields: { item: [['content:encoded', 'content'], ['dc:creator', 'creator']] }
});

// Simple logger
const log = (message) => console.log(`[${new Date().toISOString()}] ${message}`);

/**
 * Process a single RSS feed
 */
async function fetchAndProcessFeed(feed) {
  const { id: feedId, title, url } = feed;
  log(`Fetching feed: ${title} (${url})`);
  try {
    const feedContent = await rssParser.parseURL(url);
    await pool.query('UPDATE rss.feeds SET last_fetched = NOW() WHERE id = $1', [feedId]);

    let newItemCount = 0;
    for (const item of feedContent.items) {
      try {
        const guid = item.guid || item.link;
        if (!guid) continue;

        const existingItem = await pool.query('SELECT id FROM rss.items WHERE feed_id = $1 AND guid = $2', [feedId, guid]);
        if (existingItem.rows.length === 0) {
          await pool.query(`
            INSERT INTO rss.items (feed_id, guid, title, link, description, content, author, published_date, categories)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
          `, [
            feedId, 
            guid, 
            item.title || 'No Title', 
            item.link,
            item.description || item.contentSnippet || '',
            item.content || item['content:encoded'] || '',
            item.author || item.creator || null,
            item.pubDate ? new Date(item.pubDate) : new Date(),
            item.categories || []
          ]);
          newItemCount++;
        }
      } catch (itemError) {
        log(`Error processing item "${item.title}" for feed ${feedId}: ${itemError.message}`);
      }
    }
    log(`Processed feed ${title}. Added ${newItemCount} new items.`);
  } catch (fetchError) {
    log(`Error fetching feed ${title}: ${fetchError.message}`);
  }
}

/**
 * Main function to fetch all RSS feeds
 */
async function fetchAllFeeds() {
  log('Starting RSS feed fetch process...');
  try {
    const result = await pool.query('SELECT * FROM rss.feeds WHERE active = true');
    const feeds = result.rows;
    log(`Found ${feeds.length} active feeds.`);
    
    for (const feed of feeds) {
      await fetchAndProcessFeed(feed);
    }
    
    log('RSS feed fetch process completed successfully.');
  } catch (error) {
    log(`Error in RSS feed fetch process: ${error.message}`);
  } finally {
    // Close the database connection
    await pool.end();
  }
}

// Run the fetcher
fetchAllFeeds().catch(error => {
  console.error('Fatal error in RSS fetcher:', error);
  process.exit(1);
});
