import { NextResponse } from 'next/server';
import { Pool } from 'pg';
import { logger } from '@/lib/logger';
import path from 'path';
import { 
  sendMessageToTelegram, 
  sendAudioToTelegram, 
  formatSummaryMessage, 
  formatPodcastCaption 
} from '@/services/telegram';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

// Function to check if Telegram is configured properly
function isTelegramConfigured(): boolean {
  return !!(process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_CHAT_ID);
}

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  const articleId = parseInt(params.id, 10);

  if (isNaN(articleId)) {
    return NextResponse.json({ error: 'Invalid article ID' }, { status: 400 });
  }

  if (!isTelegramConfigured()) {
    return NextResponse.json(
      { error: 'Telegram service is not configured correctly. Please check environment variables.' }, 
      { status: 503 }
    );
  }

  try {
    // Fetch article details with summary and podcast
    const articleRes = await pool.query(`
      SELECT i.id as item_id, i.title as item_title, i.link as item_link,
             f.title as feed_title,
             s.id as summary_id, s.summary_text,
             p.id as podcast_id, p.audio_file_path
      FROM rss.items i
      JOIN rss.feeds f ON i.feed_id = f.id
      LEFT JOIN rss.summaries s ON i.id = s.item_id
      LEFT JOIN rss.podcasts p ON s.id = p.summary_id
      WHERE i.id = $1
      ORDER BY s.created_at DESC, p.created_at DESC
      LIMIT 1
    `, [articleId]);

    if (articleRes.rows.length === 0) {
      return NextResponse.json({ error: 'Article not found' }, { status: 404 });
    }

    const article = articleRes.rows[0];
    const results = { summary: false, podcast: false };

    // Send summary to Telegram if available
    if (article.summary_id && article.summary_text) {
      try {
        // Format and send message
        const message = formatSummaryMessage(
          article.item_title,
          article.summary_text,
          article.item_link,
          article.feed_title
        );
        
        await sendMessageToTelegram(message);
        results.summary = true;
        logger.info(`Summary sent to Telegram for article: ${article.item_title}`);
      } catch (error) {
        logger.error(`Error sending summary to Telegram: ${error}`);
      }
    }

    // Send podcast to Telegram if available
    if (article.podcast_id && article.audio_file_path) {
      try {
        // Get file path
        const audioPath = path.join(
          process.cwd(), 
          'public', 
          article.audio_file_path.replace(/^\//, '')
        );
        
        // Format caption
        const caption = formatPodcastCaption(
          article.item_title,
          article.item_link,
          article.feed_title
        );
        
        // Send audio
        await sendAudioToTelegram(audioPath, caption);
        results.podcast = true;
        logger.info(`Podcast sent to Telegram for article: ${article.item_title}`);
      } catch (error) {
        logger.error(`Error sending podcast to Telegram: ${error}`);
      }
    }

    // Return results
    if (!results.summary && !results.podcast) {
      return NextResponse.json(
        { error: 'No content available to send to Telegram' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      sent: results,
      message: 'Content sent to Telegram successfully'
    });

  } catch (error) {
    logger.error(`Error sending content to Telegram for article ${articleId}:`, error);
    return NextResponse.json(
      { error: 'Failed to send content to Telegram' },
      { status: 500 }
    );
  }
}
