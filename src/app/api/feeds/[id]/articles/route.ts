import { NextResponse } from 'next/server';
import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  const feedId = parseInt(params.id, 10);

  if (isNaN(feedId)) {
    return NextResponse.json({ error: 'Invalid feed ID' }, { status: 400 });
  }

  try {
    // Check if feed exists
     const feedCheck = await pool.query('SELECT id FROM rss.feeds WHERE id = $1', [feedId]);
     if (feedCheck.rows.length === 0) {
         return NextResponse.json({ error: 'Feed not found' }, { status: 404 });
     }

    // Fetch articles for the specific feed
    const result = await pool.query(
      `SELECT 
        i.id, i.feed_id, i.title, i.link, i.description, i.author, 
        i.published_date, i.is_read, i.is_bookmarked,
        EXISTS (SELECT 1 FROM rss.summaries s WHERE s.item_id = i.id) as has_summary,
        EXISTS (SELECT 1 FROM rss.podcasts p WHERE p.item_id = i.id) as has_podcast
       FROM rss.items i 
       WHERE i.feed_id = $1 
       ORDER BY i.published_date DESC`,
      [feedId]
    );
    
    return NextResponse.json(result.rows);
  } catch (error) {
    console.error(`Error fetching articles for feed ${feedId}:`, error);
    return NextResponse.json(
      { error: 'Failed to fetch articles for this feed' },
      { status: 500 }
    );
  }
}
