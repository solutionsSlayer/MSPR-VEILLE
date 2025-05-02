import { NextResponse } from 'next/server';
import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  const articleId = parseInt(params.id, 10);

  if (isNaN(articleId)) {
    return NextResponse.json({ error: 'Invalid article ID' }, { status: 400 });
  }

  try {
    // Fetch article details
    const articleRes = await pool.query(
      `SELECT i.*, f.title as feed_title 
       FROM rss.items i
       JOIN rss.feeds f ON i.feed_id = f.id
       WHERE i.id = $1`,
      [articleId]
    );

    if (articleRes.rows.length === 0) {
      return NextResponse.json({ error: 'Article not found' }, { status: 404 });
    }
    const article = articleRes.rows[0];

    // Fetch summary if exists
    const summaryRes = await pool.query(
      'SELECT * FROM rss.summaries WHERE item_id = $1 ORDER BY created_at DESC LIMIT 1',
      [articleId]
    );
    const summary = summaryRes.rows.length > 0 ? summaryRes.rows[0] : null;

    // Fetch podcast if exists
    const podcastRes = await pool.query(
      'SELECT * FROM rss.podcasts WHERE item_id = $1 ORDER BY created_at DESC LIMIT 1',
      [articleId]
    );
    const podcast = podcastRes.rows.length > 0 ? podcastRes.rows[0] : null;

    return NextResponse.json({ article, summary, podcast });

  } catch (error) {
    console.error('Error fetching article details:', error);
    return NextResponse.json(
      { error: 'Failed to fetch article details' },
      { status: 500 }
    );
  }
}
