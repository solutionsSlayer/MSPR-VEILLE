import { NextResponse } from 'next/server';
import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  const articleId = parseInt(params.id, 10);

  if (isNaN(articleId)) {
    return NextResponse.json({ error: 'Invalid article ID' }, { status: 400 });
  }

  try {
      const body = await request.json();
      const { is_read } = body;

       if (typeof is_read !== 'boolean') {
            return NextResponse.json({ error: 'Invalid value for is_read, must be boolean.'}, { status: 400});
       }

    // Update the is_read status for the article
    const result = await pool.query(
      'UPDATE rss.items SET is_read = $1 WHERE id = $2 RETURNING id, is_read',
      [is_read, articleId]
    );

    if (result.rowCount === 0) {
      return NextResponse.json({ error: 'Article not found' }, { status: 404 });
    }

    return NextResponse.json(result.rows[0]);

  } catch (error) {
    console.error('Error updating read status:', error);
    return NextResponse.json(
      { error: 'Failed to update read status' },
      { status: 500 }
    );
  }
}
