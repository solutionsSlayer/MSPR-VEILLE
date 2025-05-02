/**
 * Podcast Generator Service
 * 
 * This service is responsible for generating audio podcasts from summaries using the ElevenLabs API.
 * It runs as a CRON job, finding summaries without podcasts and generating them.
 */

import cron from 'node-cron';
import { Pool } from 'pg';
import axios from 'axios';
import fs from 'fs';
import path from 'path';
import { logger } from '../../lib/logger';

// Database connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

// ElevenLabs API configuration
const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY;
const ELEVENLABS_API_URL = 'https://api.elevenlabs.io/v1/text-to-speech';

// Voice IDs for different languages
// These should be replaced with your actual voice IDs from ElevenLabs
const VOICE_IDS = {
  en: process.env.ELEVENLABS_EN_VOICE_ID || 'pNInz6obpgDQGcFmaJgB', // Example English voice ID
  fr: process.env.ELEVENLABS_FR_VOICE_ID || 'EXAVITQu4vr4xnSDxMaL'  // Example French voice ID
};

// Base directory for storing podcast files
const PODCASTS_DIR = process.env.PODCASTS_DIR || path.join(process.cwd(), 'public', 'podcasts');

/**
 * Get summaries that don't have podcast versions yet
 * @param limit Maximum number of summaries to process in one batch
 */
async function getSummariesWithoutPodcasts(limit = 5) {
  try {
    const result = await pool.query(`
      SELECT s.*, i.title as item_title, f.title as feed_title
      FROM rss.summaries s
      JOIN rss.items i ON s.item_id = i.id
      JOIN rss.feeds f ON i.feed_id = f.id
      LEFT JOIN rss.podcasts p ON s.id = p.summary_id
      WHERE p.id IS NULL
      ORDER BY s.created_at ASC
      LIMIT $1
    `, [limit]);
    
    return result.rows;
  } catch (error) {
    logger.error('Error fetching summaries without podcasts:', error);
    return [];
  }
}

/**
 * Generate a podcast for a single summary using ElevenLabs API
 * @param summary The summary to convert to speech
 */
async function generatePodcast(summary: any) {
  try {
    // Ensure the podcasts directory exists
    await fs.promises.mkdir(PODCASTS_DIR, { recursive: true });
    
    // Create a subdirectory for this feed
    const feedDir = path.join(PODCASTS_DIR, sanitizeFilename(summary.feed_title));
    await fs.promises.mkdir(feedDir, { recursive: true });
    
    // Create filename from the item title
    const fileName = `${sanitizeFilename(summary.item_title)}.mp3`;
    const filePath = path.join(feedDir, fileName);
    const relativePath = path.relative(process.cwd(), filePath);
    
    // Prepare text for TTS
    const text = `${summary.item_title}. ${summary.summary_text}`;
    
    // Select voice based on language
    const voiceId = VOICE_IDS[summary.language as keyof typeof VOICE_IDS] || VOICE_IDS.en;
    
    // Call ElevenLabs API
    const response = await axios({
      method: 'POST',
      url: `${ELEVENLABS_API_URL}/${voiceId}`,
      headers: {
        'Accept': 'audio/mpeg',
        'Content-Type': 'application/json',
        'xi-api-key': ELEVENLABS_API_KEY
      },
      data: {
        text,
        model_id: 'eleven_multilingual_v2',
        voice_settings: {
          stability: 0.5,
          similarity_boost: 0.75
        }
      },
      responseType: 'stream'
    });
    
    // Save the audio file
    const writer = fs.createWriteStream(filePath);
    response.data.pipe(writer);
    
    return new Promise<void>((resolve, reject) => {
      writer.on('finish', async () => {
        try {
          // Get audio duration (this would require a library like music-metadata in a real implementation)
          // For simplicity, we'll estimate duration based on character count
          const estimatedDuration = Math.ceil(text.length / 20); // Rough estimate: 20 chars per second
          
          // Save podcast info to database
          const result = await pool.query(`
            INSERT INTO rss.podcasts (item_id, summary_id, audio_file_path, duration, voice_id)
            VALUES ($1, $2, $3, $4, $5)
            RETURNING id
          `, [summary.item_id, summary.id, relativePath, estimatedDuration, voiceId]);
          
          logger.info(`Created podcast ${result.rows[0].id} for summary ${summary.id}`);
          resolve();
        } catch (error) {
          reject(error);
        }
      });
      
      writer.on('error', reject);
    });
  } catch (error) {
    logger.error(`Error generating podcast for summary ${summary.id}:`, error);
    throw error;
  }
}

/**
 * Sanitize a string to be used as a filename
 * @param name The string to sanitize
 */
function sanitizeFilename(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^\w\s-]/g, '') // Remove non-word chars
    .replace(/[\s_-]+/g, '-') // Replace spaces, underscores, and hyphens with a single hyphen
    .replace(/^-+|-+$/g, ''); // Remove leading/trailing hyphens
}

/**
 * Process all summaries without podcasts
 * @param limit Maximum number of summaries to process in one batch
 */
async function processSummariesWithoutPodcasts(limit = 5) {
  logger.info('Starting podcast generation job');
  
  try {
    const summaries = await getSummariesWithoutPodcasts(limit);
    logger.info(`Found ${summaries.length} summaries without podcasts`);
    
    for (const summary of summaries) {
      await generatePodcast(summary);
      
      // Add a delay between API calls to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    logger.info('Completed podcast generation job');
  } catch (error) {
    logger.error('Error in podcast generation job:', error);
  }
}

/**
 * Start the CRON job to periodically generate podcasts
 * Default: Run once every 6 hours
 */
export function startPodcastGenerator() {
  const cronSchedule = process.env.PODCAST_GEN_CRON || '0 */6 * * *'; // Default: Every 6 hours
  const batchSize = parseInt(process.env.PODCAST_GEN_BATCH_SIZE || '5', 10);
  
  // Check if ElevenLabs API key is set
  if (!ELEVENLABS_API_KEY) {
    logger.error('ElevenLabs API key is not set. Podcast generation will not work.');
    return;
  }
  
  logger.info(`Starting podcast generator with schedule: ${cronSchedule}`);
  
  cron.schedule(cronSchedule, () => processSummariesWithoutPodcasts(batchSize));
  
  // Run once at startup if enabled
  if (process.env.PODCAST_GEN_RUN_AT_STARTUP === 'true') {
    processSummariesWithoutPodcasts(batchSize);
  }
}

/**
 * If this module is run directly, start the service
 */
if (require.main === module) {
  startPodcastGenerator();
}
