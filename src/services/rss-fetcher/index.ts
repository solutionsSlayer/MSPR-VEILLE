/**
 * RSS Fetcher Service
 * 
 * This service is responsible for periodically fetching RSS feeds from the database,
 * downloading the latest content, and saving new items to the database.
 */

import cron from 'node-cron';
import { Pool } from 'pg';
import Parser from 'rss-parser';
import { logger } from '../../lib/logger';

// Database connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

// RSS Parser instance
const parser = new Parser({
  customFields: {
    item: [
      ['content:encoded', 'content'],
      ['dc:creator', 'creator'],
      ['media:content', 'media']
    ]
  }
});

/**
 * Fetch all active RSS feeds from the database
 */
async function getActiveFeeds() {
  try {
    const result = await pool.query('SELECT * FROM rss.feeds WHERE active = true');
    return result.rows;
  } catch (error) {
    logger.error('Error fetching active feeds:', error);
    return [];
  }
}

/**
 * Fetch and parse an RSS feed
 * @param feed The feed object from the database
 */
async function fetchFeed(feed: any) {
  try {
    logger.info(`Fetching feed: ${feed.title} (${feed.url})`);
    const feedContent = await parser.parseURL(feed.url);
    
    // Update the feed last_fetched time
    await pool.query(
      'UPDATE rss.feeds SET last_fetched = NOW() WHERE id = $1',
      [feed.id]
    );
    
    return feedContent;
  } catch (error) {
    logger.error(`Error fetching feed ${feed.title}:`, error);
    return null;
  }
}

/**
 * Process feed items and save new ones to the database
 * @param feedId The database ID of the feed
 * @param items The items from the parsed feed
 */
async function processItems(feedId: number, items: any[]) {
  for (const item of items) {
    try {
      // Check if this item already exists in the database
      const existingItem = await pool.query(
        'SELECT id FROM rss.items WHERE feed_id = $1 AND guid = $2',
        [feedId, item.guid || item.link]
      );
      
      if (existingItem.rows.length === 0) {
        // This is a new item, insert it
        await pool.query(`
          INSERT INTO rss.items (
            feed_id, guid, title, link, description, content, author, 
            published_date, categories
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        `, [
          feedId,
          item.guid || item.link,
          item.title,
          item.link,
          item.description || '',
          item.content || item['content:encoded'] || '',
          item.author || item.creator || '',
          item.pubDate ? new Date(item.pubDate) : new Date(),
          item.categories || []
        ]);
        
        logger.info(`Added new item: ${item.title}`);
      }
    } catch (error) {
      logger.error(`Error processing item ${item.title}:`, error);
    }
  }
}

/**
 * Main function to fetch and process all feeds
 */
async function fetchAllFeeds() {
  logger.info('Starting RSS feed fetch job');
  
  try {
    const feeds = await getActiveFeeds();
    logger.info(`Found ${feeds.length} active feeds`);
    
    for (const feed of feeds) {
      const feedContent = await fetchFeed(feed);
      
      if (feedContent && feedContent.items) {
        await processItems(feed.id, feedContent.items);
      }
    }
    
    logger.info('Completed RSS feed fetch job');
  } catch (error) {
    logger.error('Error in feed fetch job:', error);
  }
}

/**
 * Start the CRON job to periodically fetch feeds
 * Default: Run once per hour
 */
export function startRssFetcher() {
  const cronSchedule = process.env.RSS_FETCH_CRON || '0 * * * *'; // Default: Once per hour
  
  logger.info(`Starting RSS fetcher with schedule: ${cronSchedule}`);
  
  cron.schedule(cronSchedule, fetchAllFeeds);
  
  // Run once at startup
  fetchAllFeeds();
}

/**
 * If this module is run directly, start the fetcher
 */
if (require.main === module) {
  startRssFetcher();
}
