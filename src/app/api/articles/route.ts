import { NextResponse } from 'next/server';
import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const feedId = searchParams.get('feedId');

  try {
    let query = `
      SELECT 
        i.id, i.feed_id, i.title, i.link, i.description, i.author, 
        i.published_date, i.is_read, i.is_bookmarked,
        EXISTS (SELECT 1 FROM rss.summaries s WHERE s.item_id = i.id) as has_summary,
        EXISTS (SELECT 1 FROM rss.podcasts p WHERE p.item_id = i.id) as has_podcast
      FROM rss.items i
    `;
    const queryParams = [];

    if (feedId) {
      query += ' WHERE i.feed_id = $1';
      queryParams.push(parseInt(feedId, 10));
    }

    query += ' ORDER BY i.published_date DESC';

    const result = await pool.query(query, queryParams);
    
    return NextResponse.json(result.rows);
  } catch (error) {
    console.error('Error fetching articles:', error);
    // Check if the error is due to invalid feedId format
    if (error instanceof Error && error.message.includes('invalid input syntax for type integer')) {
       return NextResponse.json({ error: 'Invalid feed ID format' }, { status: 400 });
    }
    return NextResponse.json(
      { error: 'Failed to fetch articles' },
      { status: 500 }
    );
  }
}
