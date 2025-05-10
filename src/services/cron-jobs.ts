/**
 * Main CRON Orchestration Service
 *
 * This script sets up and runs the different background tasks (RSS fetching, AI summarizing, Podcast generation)
 * based on configured CRON schedules. It imports and uses the logic from the individual service files.
 */

import cron from 'node-cron';
import { Pool } from 'pg';
import Parser from 'rss-parser';
import axios from 'axios';
import fs from 'fs';
import path from 'path';
import { ai } from '../ai/ai-instance';
import { logger } from '../lib/logger';

// Extend the Item type from rss-parser with our additional properties
interface ExtendedItem extends Parser.Item {
  content?: string;
  'content:encoded'?: string;
  contentSnippet?: string;
  description?: string;
  author?: string;
  creator?: string;
}

// --- Configuration ---
const DATABASE_URL = process.env.DATABASE_URL;
const RSS_FETCH_CRON = process.env.RSS_FETCH_CRON || '0 * * * *';         // Default: Every hour
const AI_SUMMARY_CRON = process.env.AI_SUMMARY_CRON || '0 */3 * * *';    // Default: Every 3 hours
const AI_SUMMARY_BATCH_SIZE = parseInt(process.env.AI_SUMMARY_BATCH_SIZE || '10', 10);
const PODCAST_GEN_CRON = process.env.PODCAST_GEN_CRON || '0 */6 * * *';   // Default: Every 6 hours
const PODCAST_GEN_BATCH_SIZE = parseInt(process.env.PODCAST_GEN_BATCH_SIZE || '5', 10);
const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY;
const PODCASTS_DIR = process.env.PODCASTS_DIR || path.join(process.cwd(), 'public', 'podcasts');
const VOICE_IDS: Record<string, string> = {
  en: process.env.ELEVENLABS_EN_VOICE_ID || 'pNInz6obpgDQGcFmaJgB',
  fr: process.env.ELEVENLABS_FR_VOICE_ID || 'EXAVITQu4vr4xnSDxMaL',
};

const log = logger.forService('cron-orchestrator');

// --- Database and Parsers ---
const pool = new Pool({ connectionString: DATABASE_URL });
const rssParser = new Parser({
  customFields: { item: [['content:encoded', 'content'], ['dc:creator', 'creator']] }
});

// --- Helper Functions (Copied/adapted from individual services) ---

// Language Detection
function detectLanguage(text: string): string {
  const frenchWords = ['le', 'la', 'les', 'un', 'une', 'des', 'et', 'est', 'sont', 'dans'];
  const englishWords = ['the', 'a', 'an', 'and', 'is', 'are', 'in', 'on', 'with', 'for'];
  const lowerText = text?.toLowerCase() || '';
  let frenchCount = 0;
  let englishCount = 0;
  frenchWords.forEach(word => { (lowerText.match(new RegExp(`\\b${word}\\b`, 'g')) || []).forEach(() => frenchCount++); });
  englishWords.forEach(word => { (lowerText.match(new RegExp(`\\b${word}\\b`, 'g')) || []).forEach(() => englishCount++); });
  return frenchCount > englishCount ? 'fr' : 'en';
}

// Sanitize Filename
function sanitizeFilename(name: string): string {
  return name.trim().toLowerCase().replace(/[^\w\s-]/g, '').replace(/[\s_-]+/g, '-').replace(/^-+|-+$/g, '');
}

// --- RSS Fetcher Logic ---
async function fetchAndProcessFeed(feed: any) {
  const { id: feedId, title, url } = feed;
  log.info(`Fetching feed: ${title} (${url})`);
  try {
    const feedContent = await rssParser.parseURL(url);
    await pool.query('UPDATE rss.feeds SET last_fetched = NOW() WHERE id = $1', [feedId]);

    let newItemCount = 0;
    for (const item of feedContent.items as ExtendedItem[]) {
      try {
        const guid = item.guid || item.link;
        if (!guid) continue;

        const existingItem = await pool.query('SELECT id FROM rss.items WHERE feed_id = $1 AND guid = $2', [feedId, guid]);
        if (existingItem.rows.length === 0) {
          await pool.query(`
            INSERT INTO rss.items (feed_id, guid, title, link, description, content, author, published_date, categories)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
          `, [
            feedId, guid, item.title || 'No Title', item.link,
            item.description || item.contentSnippet || '',
            item.content || item['content:encoded'] || '',
            item.author || item.creator || null,
            item.pubDate ? new Date(item.pubDate) : new Date(),
            item.categories || []
          ]);
          newItemCount++;
        }
      } catch (itemError) {
        log.error(`Error processing item "${item.title}" for feed ${feedId}:`, itemError);
      }
    }
    log.info(`Finished processing feed ${title}. Added ${newItemCount} new items.`);
  } catch (fetchError) {
    log.error(`Error fetching feed ${title}:`, fetchError);
  }
}

async function runRssFetcherJob() {
  log.info('Starting RSS Feed Fetch Job...');
  try {
    const result = await pool.query('SELECT * FROM rss.feeds WHERE active = true');
    const feeds = result.rows;
    log.info(`Found ${feeds.length} active feeds.`);
    await Promise.all(feeds.map(feed => fetchAndProcessFeed(feed)));
  } catch (error) {
    log.error('Error during RSS Feed Fetch Job:', error);
  }
  log.info('Finished RSS Feed Fetch Job.');
}

// --- AI Summary Logic ---
async function generateAndSaveSummary(item: {
  id: number;
  title: string;
  content?: string;
  description?: string;
}) {
  const { id: itemId, title, content, description } = item;
  log.info(`Generating summary for item ID: ${itemId}`);
  try {
    const contentToSummarize = content || description || '';
    if (!contentToSummarize && !title) {
      log.warn(`Item ${itemId} has no content to summarize.`);
      return;
    }

    const prompt = `Summarize the following article in 3-5 concise paragraphs:\n\nTITLE: ${title}\n\nCONTENT:\n${contentToSummarize}`;
    const response = await ai.generate({ prompt });
    const summaryText = response.text;

    if (!summaryText) throw new Error('AI returned empty summary.');

    const language = detectLanguage(contentToSummarize);
    await pool.query(
      `INSERT INTO rss.summaries (item_id, summary_text, language) VALUES ($1, $2, $3)`,
      [itemId, summaryText, language]
    );
    log.info(`Successfully generated and saved summary for item ID: ${itemId}`);
  } catch (error) {
    log.error(`Error generating summary for item ID ${itemId}:`, error);
  }
}

async function runAiSummaryJob() {
  log.info(`Starting AI Summary Job (Batch Size: ${AI_SUMMARY_BATCH_SIZE})...`);
  try {
    const result = await pool.query(`
      SELECT i.* FROM rss.items i
      LEFT JOIN rss.summaries s ON i.id = s.item_id
      WHERE s.id IS NULL
      ORDER BY i.published_date DESC
      LIMIT $1
    `, [AI_SUMMARY_BATCH_SIZE]);
    const itemsToSummarize = result.rows;
    log.info(`Found ${itemsToSummarize.length} items needing summaries.`);

    for (const item of itemsToSummarize) {
      await generateAndSaveSummary(item);
      await new Promise(resolve => setTimeout(resolve, 500)); // Delay between AI calls
    }
  } catch (error) {
    log.error('Error during AI Summary Job:', error);
  }
  log.info('Finished AI Summary Job.');
}

// --- Podcast Generator Logic ---
async function generateAndSavePodcast(summary: {
  id: number;
  item_id: number;
  summary_text: string;
  language: string;
  item_title?: string;
  feed_title?: string;
}) {
  const { id: summaryId, item_id: itemId, summary_text: summaryText, language, item_title, feed_title } = summary;
  log.info(`Generating podcast for summary ID: ${summaryId} (Item ID: ${itemId})`);
  try {
    await fs.promises.mkdir(PODCASTS_DIR, { recursive: true });
    const feedDir = path.join(PODCASTS_DIR, sanitizeFilename(feed_title || 'default-feed'));
    await fs.promises.mkdir(feedDir, { recursive: true });

    const fileName = `${sanitizeFilename(item_title || `podcast-${summaryId}`)}.mp3`;
    const absoluteFilePath = path.join(feedDir, fileName);
    const publicRelativePath = path.join('podcasts', sanitizeFilename(feed_title || 'default-feed'), fileName); // Relative to /public

    const textToSpeak = `${item_title || ''}. ${summaryText}`;
    const voiceId = VOICE_IDS[language] || VOICE_IDS.en;

    const response = await axios({
      method: 'POST',
      url: `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`,
      headers: { 'Accept': 'audio/mpeg', 'Content-Type': 'application/json', 'xi-api-key': ELEVENLABS_API_KEY },
      data: { text: textToSpeak, model_id: 'eleven_multilingual_v2', voice_settings: { stability: 0.5, similarity_boost: 0.75 } },
      responseType: 'stream',
    });

    const writer = fs.createWriteStream(absoluteFilePath);
    response.data.pipe(writer);

    await new Promise<void>((resolve, reject) => {
      writer.on('finish', async () => {
        try {
          const estimatedDuration = Math.ceil(textToSpeak.length / 15); // Simple estimation
          await pool.query(
            `INSERT INTO rss.podcasts (item_id, summary_id, audio_file_path, duration, voice_id)
             VALUES ($1, $2, $3, $4, $5)`,
            [itemId, summaryId, `/${publicRelativePath}`, estimatedDuration, voiceId] // Store URL path
          );
          log.info(`Successfully generated and saved podcast for summary ID: ${summaryId}`);
          resolve();
        } catch (dbError) { reject(dbError); }
      });
      writer.on('error', (streamError) => {
            log.error(`Error writing audio file for summary ${summaryId}:`, streamError);
            fs.unlink(absoluteFilePath, (unlinkErr) => {
                if(unlinkErr) log.error(`Failed to delete partial file ${absoluteFilePath}:`, unlinkErr);
            });
            reject(streamError);
        });
    });
  } catch (error: any) {
    log.error(`Error generating podcast for summary ID ${summaryId}:`, error.response?.data || error.message || error);
  }
}

async function runPodcastGeneratorJob() {
   if (!ELEVENLABS_API_KEY) {
        log.warn('Skipping Podcast Generation Job: ELEVENLABS_API_KEY not set.');
        return;
    }
  log.info(`Starting Podcast Generation Job (Batch Size: ${PODCAST_GEN_BATCH_SIZE})...`);
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
    const summariesToConvert = result.rows;
    log.info(`Found ${summariesToConvert.length} summaries needing podcasts.`);

    for (const summary of summariesToConvert) {
      await generateAndSavePodcast(summary);
      await new Promise(resolve => setTimeout(resolve, 1000)); // Delay between API calls
    }
  } catch (error) {
    log.error('Error during Podcast Generation Job:', error);
  }
  log.info('Finished Podcast Generation Job.');
}

// --- CRON Scheduling ---
log.info('Setting up CRON jobs...');

if (cron.validate(RSS_FETCH_CRON)) {
  cron.schedule(RSS_FETCH_CRON, runRssFetcherJob);
  log.info(`Scheduled RSS Fetcher job with pattern: ${RSS_FETCH_CRON}`);
} else {
  log.error(`Invalid CRON pattern for RSS Fetcher: ${RSS_FETCH_CRON}. Job not scheduled.`);
}

if (cron.validate(AI_SUMMARY_CRON)) {
  cron.schedule(AI_SUMMARY_CRON, runAiSummaryJob);
  log.info(`Scheduled AI Summary job with pattern: ${AI_SUMMARY_CRON}`);
} else {
  log.error(`Invalid CRON pattern for AI Summary: ${AI_SUMMARY_CRON}. Job not scheduled.`);
}

if (cron.validate(PODCAST_GEN_CRON)) {
  cron.schedule(PODCAST_GEN_CRON, runPodcastGeneratorJob);
  log.info(`Scheduled Podcast Generator job with pattern: ${PODCAST_GEN_CRON}`);
} else {
  log.error(`Invalid CRON pattern for Podcast Generator: ${PODCAST_GEN_CRON}. Job not scheduled.`);
}

// --- Initial Run (Optional) ---
// Optionally run jobs once on startup
if (process.env.RUN_JOBS_ON_STARTUP === 'true') {
    log.info('Running initial jobs on startup...');
    Promise.all([
        runRssFetcherJob(),
        // Add delays or chain them if needed to avoid resource contention
        // runAiSummaryJob(),
        // runPodcastGeneratorJob()
    ]).catch(err => log.error('Error during initial job run:', err));
}

log.info('CRON Orchestrator started.');

// Keep the process running (if needed, e.g., when not run via a process manager)
// process.stdin.resume(); // Uncomment if running directly and need it to stay alive
