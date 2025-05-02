import { NextResponse } from 'next/server';
import { Pool } from 'pg';

// Database connection pool
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

export async function GET() {
  try {
    const result = await pool.query(
      'SELECT * FROM rss.feeds ORDER BY title ASC'
    );
    
    return NextResponse.json(result.rows);
  } catch (error) {
    console.error('Error fetching feeds:', error);
    return NextResponse.json(
      { error: 'Failed to fetch feeds' },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { title, url, description, language, category } = body;
    
    // Check if feed URL already exists
    const existingFeed = await pool.query(
      'SELECT id FROM rss.feeds WHERE url = $1',
      [url]
    );
    
    if (existingFeed.rows.length > 0) {
      return NextResponse.json(
        { error: 'Feed URL already exists' },
        { status: 400 }
      );
    }
    
    // Insert new feed
    const result = await pool.query(
      `INSERT INTO rss.feeds (
        title, url, description, language, category, active
      ) VALUES ($1, $2, $3, $4, $5, true) RETURNING *`,
      [title, url, description, language, category]
    );
    
    return NextResponse.json(result.rows[0], { status: 201 });
  } catch (error) {
    console.error('Error creating feed:', error);
    return NextResponse.json(
      { error: 'Failed to create feed' },
      { status: 500 }
    );
  }
}
