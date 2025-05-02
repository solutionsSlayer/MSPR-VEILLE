import { NextResponse } from 'next/server';
import { Pool } from 'pg';
import Parser from 'rss-parser';
import { logger } from '@/lib/logger';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

const parser = new Parser({
  customFields: {
    item: [['content:encoded', 'content'], ['dc:creator', 'creator']],
  }
});

// Reusable function to process items (similar to the one in rss-fetcher service)
async function processItems(feedId: number, items: any[]) {
    let newItemCount = 0;
    for (const item of items) {
      try {
        const guid = item.guid || item.link;
        if (!guid) {
             logger.warn(`Skipping item without guid or link in feed ${feedId}: ${item.title}`);
             continue;
        }

        const existingItem = await pool.query(
          'SELECT id FROM rss.items WHERE feed_id = $1 AND guid = $2',
          [feedId, guid]
        );

        if (existingItem.rows.length === 0) {
          await pool.query(`
            INSERT INTO rss.items (
              feed_id, guid, title, link, description, content, author,
              published_date, categories
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
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
      } catch (error) {
        logger.error(`Error processing item "${item.title}" for feed ${feedId}:`, error);
        // Continue processing other items
      }
    }
    return newItemCount;
}


export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  const feedId = parseInt(params.id, 10);

  if (isNaN(feedId)) {
    return NextResponse.json({ error: 'Invalid feed ID' }, { status: 400 });
  }

  const serviceLogger = logger.forService('feed-refresh-api');

  try {
    // Get feed URL from database
    const feedRes = await pool.query('SELECT url, title FROM rss.feeds WHERE id = $1 AND active = true', [feedId]);
    if (feedRes.rows.length === 0) {
      return NextResponse.json({ error: 'Active feed not found or does not exist' }, { status: 404 });
    }
    const feed = feedRes.rows[0];

    serviceLogger.info(`Manual refresh triggered for feed: ${feed.title} (${feed.url})`);

    // Fetch and parse the feed
     let feedContent;
     try {
        feedContent = await parser.parseURL(feed.url);
     } catch (parseError) {
         serviceLogger.error(`Failed to fetch or parse feed ${feed.title} (${feed.url}):`, parseError);
         return NextResponse.json({ error: `Failed to fetch or parse feed: ${parseError instanceof Error ? parseError.message : 'Unknown error'}` }, { status: 502 }); // Bad Gateway
     }


    // Process items and save new ones
    const newItemCount = await processItems(feedId, feedContent.items || []);

    // Update last_fetched timestamp
    await pool.query('UPDATE rss.feeds SET last_fetched = NOW() WHERE id = $1', [feedId]);

    serviceLogger.info(`Feed refresh completed for ${feed.title}. Added ${newItemCount} new items.`);
    return NextResponse.json({ message: `Feed refreshed successfully. Added ${newItemCount} new items.` });

  } catch (error) {
    serviceLogger.error(`Error refreshing feed ${feedId}:`, error);
    return NextResponse.json(
      { error: 'Failed to refresh feed' },
      { status: 500 }
    );
  }
}
