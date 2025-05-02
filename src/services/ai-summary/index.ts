/**
 * AI Summary Service
 * 
 * This service is responsible for generating summaries of RSS items using Google's Gemini API.
 * It runs as a CRON job, finding items without summaries and generating them.
 */

import cron from 'node-cron';
import { Pool } from 'pg';
import { ai } from '../../ai/ai-instance';
import { logger } from '../../lib/logger';

// Database connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

/**
 * Get RSS items that don't have summaries yet
 * @param limit Maximum number of items to process in one batch
 */
async function getItemsWithoutSummaries(limit = 10) {
  try {
    const result = await pool.query(`
      SELECT i.* 
      FROM rss.items i
      LEFT JOIN rss.summaries s ON i.id = s.item_id
      WHERE s.id IS NULL
      ORDER BY i.published_date DESC
      LIMIT $1
    `, [limit]);
    
    return result.rows;
  } catch (error) {
    logger.error('Error fetching items without summaries:', error);
    return [];
  }
}

/**
 * Generate a summary for a single RSS item using Gemini AI
 * @param item The RSS item to summarize
 */
async function generateSummary(item: any) {
  try {
    // Prepare the content for summarization
    const content = item.content || item.description || '';
    const title = item.title || '';
    
    if (!content && !title) {
      logger.warn(`Item ${item.id} has no content to summarize`);
      return null;
    }
    
    // Prompt for the AI
    const prompt = `Please summarize the following article in 3-5 concise paragraphs. Focus on the key points and main takeaways.

TITLE: ${title}

CONTENT:
${content}`;

    // Get summary from Gemini
    const response = await ai.generateText({
      messages: [
        {
          role: 'user',
          content: prompt
        }
      ]
    });

    const summaryText = response.text();
    
    // Save the summary to the database
    const result = await pool.query(`
      INSERT INTO rss.summaries (item_id, summary_text, language)
      VALUES ($1, $2, $3)
      RETURNING id
    `, [item.id, summaryText, detectLanguage(content)]);
    
    logger.info(`Created summary ${result.rows[0].id} for item ${item.id}`);
    
    return result.rows[0].id;
  } catch (error) {
    logger.error(`Error generating summary for item ${item.id}:`, error);
    return null;
  }
}

/**
 * Simple language detection (can be improved with a proper library)
 * @param text Text to detect language
 */
function detectLanguage(text: string): string {
  // This is a very simple heuristic that can be improved
  const frenchWords = ['le', 'la', 'les', 'un', 'une', 'des', 'et', 'est', 'sont', 'dans'];
  const englishWords = ['the', 'a', 'an', 'and', 'is', 'are', 'in', 'on', 'with', 'for'];
  
  const lowerText = text.toLowerCase();
  let frenchCount = 0;
  let englishCount = 0;
  
  frenchWords.forEach(word => {
    const regex = new RegExp(`\\b${word}\\b`, 'g');
    const matches = lowerText.match(regex);
    if (matches) frenchCount += matches.length;
  });
  
  englishWords.forEach(word => {
    const regex = new RegExp(`\\b${word}\\b`, 'g');
    const matches = lowerText.match(regex);
    if (matches) englishCount += matches.length;
  });
  
  return frenchCount > englishCount ? 'fr' : 'en';
}

/**
 * Process all items without summaries
 * @param limit Maximum number of items to process in one batch
 */
async function processItemsWithoutSummaries(limit = 10) {
  logger.info('Starting AI summary job');
  
  try {
    const items = await getItemsWithoutSummaries(limit);
    logger.info(`Found ${items.length} items without summaries`);
    
    for (const item of items) {
      await generateSummary(item);
      
      // Add a small delay to avoid rate limiting with the AI API
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    
    logger.info('Completed AI summary job');
  } catch (error) {
    logger.error('Error in AI summary job:', error);
  }
}

/**
 * Start the CRON job to periodically generate summaries
 * Default: Run once every 3 hours
 */
export function startAiSummaryService() {
  const cronSchedule = process.env.AI_SUMMARY_CRON || '0 */3 * * *'; // Default: Every 3 hours
  const batchSize = parseInt(process.env.AI_SUMMARY_BATCH_SIZE || '10', 10);
  
  logger.info(`Starting AI summary service with schedule: ${cronSchedule}`);
  
  cron.schedule(cronSchedule, () => processItemsWithoutSummaries(batchSize));
  
  // Run once at startup
  processItemsWithoutSummaries(batchSize);
}

/**
 * If this module is run directly, start the service
 */
if (require.main === module) {
  startAiSummaryService();
}
