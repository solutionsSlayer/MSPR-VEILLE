/**
 * Simple Podcast Generator Service
 * Standalone service that generates podcast files from summaries
 */

const { Pool } = require('pg');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

// Configuration
const DATABASE_URL = process.env.DATABASE_URL;
const PODCAST_GEN_BATCH_SIZE = parseInt(process.env.PODCAST_GEN_BATCH_SIZE || '5', 10);
const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY;
const PODCASTS_DIR = process.env.PODCASTS_DIR || path.join(process.cwd(), 'public', 'podcasts');
const VOICE_IDS = {
  en: process.env.ELEVENLABS_EN_VOICE_ID || 'pNInz6obpgDQGcFmaJgB',
  fr: process.env.ELEVENLABS_FR_VOICE_ID || 'EXAVITQu4vr4xnSDxMaL',
};

// Initialize DB connection
const pool = new Pool({ connectionString: DATABASE_URL });

// Simple logger
const log = (message) => console.log(`[${new Date().toISOString()}] ${message}`);

/**
 * Sanitize filename
 */
function sanitizeFilename(name) {
  return name.trim().toLowerCase().replace(/[^\w\s-]/g, '').replace(/[\s_-]+/g, '-').replace(/^-+|-+$/g, '');
}

/**
 * Generate and save a podcast for a summary
 */
async function generateAndSavePodcast(summary) {
  const { id: summaryId, item_id: itemId, summary_text: summaryText, language, item_title, feed_title } = summary;
  log(`Generating podcast for summary ID: ${summaryId} (Item ID: ${itemId})`);
  
  // Check if ElevenLabs API key is available
  if (!ELEVENLABS_API_KEY) {
    log('Skipping podcast generation: ELEVENLABS_API_KEY not defined.');
    return;
  }
  
  try {
    // Create directories
    await fs.promises.mkdir(PODCASTS_DIR, { recursive: true });
    const feedDir = path.join(PODCASTS_DIR, sanitizeFilename(feed_title || 'default-feed'));
    await fs.promises.mkdir(feedDir, { recursive: true });

    // Define file paths
    const fileName = `${sanitizeFilename(item_title || `podcast-${summaryId}`)}.mp3`;
    const absoluteFilePath = path.join(feedDir, fileName);
    const publicRelativePath = path.join('podcasts', sanitizeFilename(feed_title || 'default-feed'), fileName);

    // Prepare text and voice
    const textToSpeak = `${item_title || ''}. ${summaryText}`;
    const voiceId = VOICE_IDS[language] || VOICE_IDS.en;

    // Call ElevenLabs API
    try {
      const response = await axios({
        method: 'POST',
        url: `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`,
        headers: { 
          'Accept': 'audio/mpeg', 
          'Content-Type': 'application/json', 
          'xi-api-key': ELEVENLABS_API_KEY 
        },
        data: { 
          text: textToSpeak, 
          model_id: 'eleven_multilingual_v2', 
          voice_settings: { 
            stability: 0.5, 
            similarity_boost: 0.75 
          } 
        },
        responseType: 'stream',
      });

      // Save the audio file
      const writer = fs.createWriteStream(absoluteFilePath);
      response.data.pipe(writer);

      // Wait for file to be written
      await new Promise((resolve, reject) => {
        writer.on('finish', async () => {
          try {
            // Calculate estimated duration
            const estimatedDuration = Math.ceil(textToSpeak.length / 15);
            
            // Save podcast info to database
            await pool.query(
              `INSERT INTO rss.podcasts (item_id, summary_id, audio_file_path, duration, voice_id)
              VALUES ($1, $2, $3, $4, $5)`,
              [itemId, summaryId, `/${publicRelativePath}`, estimatedDuration, voiceId]
            );
            
            log(`Podcast generated and saved for summary ID: ${summaryId}`);
            resolve();
          } catch (dbError) { 
            reject(dbError); 
          }
        });
        
        writer.on('error', (streamError) => {
          log(`Error writing audio file for summary ${summaryId}: ${streamError.message}`);
          fs.unlink(absoluteFilePath, (unlinkErr) => {
            if(unlinkErr) log(`Failed to delete partial file ${absoluteFilePath}: ${unlinkErr.message}`);
          });
          reject(streamError);
        });
      });
    } catch (apiError) {
      log(`Error calling ElevenLabs API for summary ID ${summaryId}: ${apiError.message || apiError}`);
    }
  } catch (error) {
    log(`Error in podcast generation for summary ID ${summaryId}: ${error.message}`);
  }
}

/**
 * Main function to generate podcasts for summaries without podcasts
 */
async function generatePodcasts() {
  log(`Starting podcast generation (batch size: ${PODCAST_GEN_BATCH_SIZE})...`);
  
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
    `, [PODCAST_GEN_BATCH_SIZE]);
    
    const summariesToVocalize = result.rows;
    log(`Found ${summariesToVocalize.length} summaries needing podcasts.`);

    for (const summary of summariesToVocalize) {
      await generateAndSavePodcast(summary);
      // Add a delay between API calls
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    log('Podcast generation completed successfully.');
  } catch (error) {
    log(`Error in podcast generation: ${error.message}`);
  } finally {
    // Close the database connection
    await pool.end();
  }
}

// Run the podcast generator
generatePodcasts().catch(error => {
  console.error('Fatal error in podcast generator:', error);
  process.exit(1);
});
