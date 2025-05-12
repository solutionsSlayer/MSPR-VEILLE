/**
 * Simple AI Summary Service
 * Standalone service that generates summaries for RSS items
 */

const { Pool } = require('pg');
const axios = require('axios');
require('dotenv').config();

// Configuration
const DATABASE_URL = process.env.DATABASE_URL;
const AI_SUMMARY_BATCH_SIZE = parseInt(process.env.AI_SUMMARY_BATCH_SIZE || '10', 10);
const GOOGLE_GENAI_API_KEY = process.env.GOOGLE_GENAI_API_KEY;

// Initialize DB connection
const pool = new Pool({ connectionString: DATABASE_URL });

// Simple logger
const log = (message) => console.log(`[${new Date().toISOString()}] ${message}`);

/**
 * Detect language of text
 */
function detectLanguage(text) {
  const frenchWords = ['le', 'la', 'les', 'un', 'une', 'des', 'et', 'est', 'sont', 'dans'];
  const englishWords = ['the', 'a', 'an', 'and', 'is', 'are', 'in', 'on', 'with', 'for'];
  const lowerText = text?.toLowerCase() || '';
  let frenchCount = 0;
  let englishCount = 0;
  
  frenchWords.forEach(word => { 
    const matches = lowerText.match(new RegExp(`\\b${word}\\b`, 'g')) || [];
    frenchCount += matches.length;
  });
  
  englishWords.forEach(word => { 
    const matches = lowerText.match(new RegExp(`\\b${word}\\b`, 'g')) || [];
    englishCount += matches.length;
  });
  
  return frenchCount > englishCount ? 'fr' : 'en';
}

/**
 * Generate and save a summary for an item
 */
async function generateAndSaveSummary(item) {
  const { id: itemId, title, content, description } = item;
  log(`Generating summary for item ID: ${itemId}`);
  
  try {
    const contentToSummarize = content || description || '';
    if (!contentToSummarize && !title) {
      log(`Item ${itemId} has no content to summarize.`);
      return;
    }

    // Simple summary generation (would use AI API in production)
    // This is a placeholder - replace with actual API call to Google Gemini or other AI service
    let summaryText;
    
    try {
      // If GOOGLE_GENAI_API_KEY is available, make a real API call
      if (GOOGLE_GENAI_API_KEY) {
        const prompt = `Summarize the following article in 3-5 concise paragraphs:\n\nTITLE: ${title}\n\nCONTENT:\n${contentToSummarize.substring(0, 5000)}`;
        
        // Mock API call - replace with actual implementation
        summaryText = `Summary of "${title}"\n\nThis article discusses important developments in technology and innovation. The key points cover recent advancements and their potential impact on the industry.\n\nThe author highlights several critical aspects that professionals should pay attention to in the coming months.`;
      } else {
        // Fallback if no API key
        summaryText = `Summary of "${title}"\n\nThis is an automated summary placeholder. Configure GOOGLE_GENAI_API_KEY for actual AI summaries.`;
      }
    } catch (aiError) {
      log(`Error calling AI API: ${aiError.message}`);
      summaryText = `Summary of "${title}" (generated without AI due to API error)\n\nThis article appears to discuss important developments relevant to the industry.`;
    }

    const language = detectLanguage(contentToSummarize);
    await pool.query(
      `INSERT INTO rss.summaries (item_id, summary_text, language) VALUES ($1, $2, $3)`,
      [itemId, summaryText, language]
    );
    
    log(`Summary generated and saved for item ID: ${itemId}`);
  } catch (error) {
    log(`Error generating summary for item ID ${itemId}: ${error.message}`);
  }
}

/**
 * Main function to generate summaries for items without summaries
 */
async function generateSummaries() {
  log(`Starting AI summary generation (batch size: ${AI_SUMMARY_BATCH_SIZE})...`);
  
  try {
    const result = await pool.query(`
      SELECT i.* FROM rss.items i
      LEFT JOIN rss.summaries s ON i.id = s.item_id
      WHERE s.id IS NULL
      ORDER BY i.published_date DESC
      LIMIT $1
    `, [AI_SUMMARY_BATCH_SIZE]);
    
    const itemsToSummarize = result.rows;
    log(`Found ${itemsToSummarize.length} items needing summaries.`);

    for (const item of itemsToSummarize) {
      await generateAndSaveSummary(item);
      // Add a delay between API calls if needed
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    
    log('AI summary generation completed successfully.');
  } catch (error) {
    log(`Error in AI summary generation: ${error.message}`);
  } finally {
    // Close the database connection
    await pool.end();
  }
}

// Run the summary generator
generateSummaries().catch(error => {
  console.error('Fatal error in AI summary generator:', error);
  process.exit(1);
});
