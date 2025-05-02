import { NextResponse } from 'next/server';
import { Pool } from 'pg';
import axios from 'axios';
import fs from 'fs';
import path from 'path';
import { logger } from '@/lib/logger';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

// ElevenLabs API configuration
const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY;
const ELEVENLABS_API_URL = 'https://api.elevenlabs.io/v1/text-to-speech';
const PODCASTS_DIR = path.join(process.cwd(), 'public', 'podcasts');

// Voice IDs (ensure these are set in .env or have defaults)
const VOICE_IDS: Record<string, string> = {
  en: process.env.ELEVENLABS_EN_VOICE_ID || 'pNInz6obpgDQGcFmaJgB', // Default English voice
  fr: process.env.ELEVENLABS_FR_VOICE_ID || 'EXAVITQu4vr4xnSDxMaL', // Default French voice
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
  const articleId = parseInt(params.id, 10);

  if (isNaN(articleId)) {
    return NextResponse.json({ error: 'Invalid article ID' }, { status: 400 });
  }

  if (!ELEVENLABS_API_KEY) {
    logger.error('ElevenLabs API key is not set.');
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

    // Fetch the latest summary for the article
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
      return NextResponse.json({ error: 'No summary found for this article to generate a podcast.' }, { status: 404 });
    }
    const summary = summaryRes.rows[0];

    logger.info(`Generating podcast for article ID: ${articleId}, summary ID: ${summary.id}`);

    // --- ElevenLabs Generation ---
    await fs.promises.mkdir(PODCASTS_DIR, { recursive: true });
    const feedDir = path.join(PODCASTS_DIR, sanitizeFilename(summary.feed_title));
    await fs.promises.mkdir(feedDir, { recursive: true });

    const fileName = `${sanitizeFilename(summary.item_title || `podcast-${summary.id}`)}.mp3`;
    const absoluteFilePath = path.join(feedDir, fileName);
     // Store relative path from 'public' directory for URL access
    const publicRelativePath = path.join('podcasts', sanitizeFilename(summary.feed_title), fileName);


    const textToSpeak = `${summary.item_title}. ${summary.summary_text}`;
    const voiceId = VOICE_IDS[summary.language] || VOICE_IDS.en; // Fallback to English voice

    const response = await axios({
      method: 'POST',
      url: `${ELEVENLABS_API_URL}/${voiceId}`,
      headers: {
        'Accept': 'audio/mpeg',
        'Content-Type': 'application/json',
        'xi-api-key': ELEVENLABS_API_KEY,
      },
      data: {
        text: textToSpeak,
        model_id: 'eleven_multilingual_v2', // Or your preferred model
        voice_settings: { stability: 0.5, similarity_boost: 0.75 },
      },
      responseType: 'stream',
    });

    // Save the audio file
    const writer = fs.createWriteStream(absoluteFilePath);
    response.data.pipe(writer);

    await new Promise<void>((resolve, reject) => {
      writer.on('finish', async () => {
        try {
          // Estimate duration (replace with actual duration calculation if possible)
          const estimatedDuration = Math.ceil(textToSpeak.length / 15); // Adjust divisor as needed

          // Save podcast metadata to database
          const result = await pool.query(
            `INSERT INTO rss.podcasts (item_id, summary_id, audio_file_path, duration, voice_id)
             VALUES ($1, $2, $3, $4, $5)
             RETURNING *`,
            [articleId, summary.id, `/${publicRelativePath}`, estimatedDuration, voiceId] // Store URL path
          );

          logger.info(`Successfully generated and saved podcast for article ID: ${articleId}`);
          resolve(result.rows[0]); // Resolve with the created podcast record
        } catch (dbError) {
          reject(dbError);
        }
      });
      writer.on('error', (streamError) => {
           logger.error(`Error writing audio file for article ${articleId}:`, streamError);
           // Attempt to clean up partially written file
           fs.unlink(absoluteFilePath, (unlinkErr) => {
               if (unlinkErr) logger.error(`Failed to delete partial file ${absoluteFilePath}:`, unlinkErr);
           });
           reject(streamError);
       });
    }).then(podcastRecord => {
         return NextResponse.json(podcastRecord, { status: 201 });
    });
    // The promise above now returns the NextResponse directly on success.

  } catch (error: any) {
    logger.error(`Error generating podcast for article ${articleId}:`, error.response?.data || error.message || error);
    const errorMessage = error.response?.data?.detail?.message || error.message || 'Failed to generate podcast';
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
