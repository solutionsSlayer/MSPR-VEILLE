import { NextResponse } from 'next/server';
import { Pool } from 'pg';
import axios from 'axios';
import fs from 'fs';
import path from 'path';
import { logger } from '@/lib/logger';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

// Simplified ElevenLabs configuration
const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY;
const PODCASTS_DIR = path.join(process.cwd(), 'public', 'podcasts');

// Voice IDs from environment
const VOICE_IDS = {
  en: process.env.ELEVENLABS_EN_VOICE_ID || 'a5n9pJUnAhX4fn7lx3uo',
  fr: process.env.ELEVENLABS_FR_VOICE_ID || 'aQROLel5sQbj1vuIVi6B',
};

// Function to sanitize filenames
function sanitizeFilename(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  // Check for cookie-based authentication or other security measures
  // This is just a placeholder - implement according to your auth system
  /*
  const session = await getSession(request);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  */
  const articleId = parseInt(params.id, 10);

  if (isNaN(articleId)) {
    return NextResponse.json({ error: 'Invalid article ID' }, { status: 400 });
  }

  if (!ELEVENLABS_API_KEY) {
    return NextResponse.json({ error: 'Podcast generation service is not configured.' }, { status: 503 });
  }

  try {
    // Check if podcast already exists for this article
    const existingPodcast = await pool.query(
      'SELECT * FROM rss.podcasts WHERE item_id = $1 ORDER BY created_at DESC LIMIT 1',
      [articleId]
    );
    if (existingPodcast.rows.length > 0) {
      return NextResponse.json(existingPodcast.rows[0]); // Return existing podcast
    }

    // Fetch the summary for the article
    const summaryRes = await pool.query(
      `SELECT s.*, i.title as item_title, f.title as feed_title
       FROM rss.summaries s
       JOIN rss.items i ON s.item_id = i.id
       JOIN rss.feeds f ON i.feed_id = f.id
       WHERE s.item_id = $1
       ORDER BY s.created_at DESC
       LIMIT 1`,
      [articleId]
    );

    if (summaryRes.rows.length === 0) {
      return NextResponse.json({ error: 'No summary found for this article.' }, { status: 404 });
    }
    
    const summary = summaryRes.rows[0];
    const voiceId = VOICE_IDS[summary.language] || VOICE_IDs.en;
    
    // Create directories
    await fs.promises.mkdir(PODCASTS_DIR, { recursive: true });
    const feedDir = path.join(PODCASTS_DIR, sanitizeFilename(summary.feed_title));
    await fs.promises.mkdir(feedDir, { recursive: true });

    // Generate filename
    const fileName = `${sanitizeFilename(summary.item_title || `podcast-${summary.id}`)}.mp3`;
    const filePath = path.join(feedDir, fileName);
    
    // Prepare text
    const textToSpeak = `${summary.item_title}. ${summary.summary_text}`.substring(0, 3000);
    
    // Generate audio with ElevenLabs - use arraybuffer
    try {
      const response = await axios({
        method: 'POST',
        url: `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`,
        headers: {
          'Accept': 'audio/mpeg',
          'Content-Type': 'application/json',
          'xi-api-key': ELEVENLABS_API_KEY,
        },
        data: {
          text: textToSpeak,
          model_id: 'eleven_multilingual_v2',
          voice_settings: { stability: 0.5, similarity_boost: 0.75 },
        },
        responseType: 'arraybuffer',
        timeout: 30000,
      });

      // Write the file
      await fs.promises.writeFile(filePath, response.data);
      
      // Save to database - important: path needs to match Nginx config
      const publicPath = `/podcasts/${sanitizeFilename(summary.feed_title)}/${fileName}`;
      const duration = Math.ceil(textToSpeak.length / 15);
      
      const result = await pool.query(
        `INSERT INTO rss.podcasts (item_id, summary_id, audio_file_path, duration, voice_id)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING *`,
        [articleId, summary.id, publicPath, duration, voiceId]
      );

      return NextResponse.json(result.rows[0], { status: 201 });
    } catch (audioError) {
      logger.error('ElevenLabs API error:', audioError.message);
      if (audioError.response) {
        logger.error(`Status: ${audioError.response.status}`);
      }
      throw new Error(`Failed to generate audio: ${audioError.message}`);
    }

  } catch (error) {
    logger.error(`Podcast generation error:`, error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}