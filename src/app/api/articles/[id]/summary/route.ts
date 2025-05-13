import { NextResponse } from 'next/server';
import { Pool } from 'pg';
import { ai } from '@/ai/ai-instance'; // Assuming ai-instance is correctly set up
import { logger } from '@/lib/logger';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

// Simple language detection (you might want a more robust solution)
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

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  const articleId = parseInt(params.id, 10);

  if (isNaN(articleId)) {
    return NextResponse.json({ error: 'Invalid article ID' }, { status: 400 });
  }

  try {
    // Check if summary already exists
    const existingSummary = await pool.query(
      'SELECT id FROM rss.summaries WHERE item_id = $1',
      [articleId]
    );
    if (existingSummary.rows.length > 0) {
       const summary = await pool.query('SELECT * FROM rss.summaries WHERE id = $1', [existingSummary.rows[0].id]);
      return NextResponse.json(summary.rows[0]); // Return existing summary
    }

    // Fetch article content
    const articleRes = await pool.query(
      'SELECT title, content, description FROM rss.items WHERE id = $1',
      [articleId]
    );
    if (articleRes.rows.length === 0) {
      return NextResponse.json({ error: 'Article not found' }, { status: 404 });
    }
    const article = articleRes.rows[0];
    const contentToSummarize = article.content || article.description || '';
    const title = article.title || '';

    if (!contentToSummarize && !title) {
      return NextResponse.json({ error: 'Article has no content to summarize' }, { status: 400 });
    }

    logger.info(`Generating summary for article ID: ${articleId}`);

    // Generate summary using Genkit AI
    // Check if content is too short (likely just a preview)
    const isPreviewOnly = contentToSummarize.length < 1000 ||
                         contentToSummarize.includes("Continue reading") ||
                         contentToSummarize.includes("Read more");

    let prompt;
    if (isPreviewOnly) {
      prompt = `The following is a preview/excerpt of an article. Based on this limited information,
provide a brief summary of what the article seems to be about. Be clear that this is based only on the preview,
and note any key topics or themes that appear to be discussed.

TITLE: ${title}

PREVIEW CONTENT:
${contentToSummarize}`;
    } else {
      prompt = `Please summarize the following article in 3-5 concise paragraphs. Focus on the key points and main takeaways.

TITLE: ${title}

CONTENT:
${contentToSummarize}`;
    }

    const response = await ai.generate({ // Use ai.generate for text
        model: 'googleai/gemini-2.0-flash', // Specify a model if not default
        prompt: prompt,
    });

    const summaryText = response.text; // Access text directly in v1.x

    if (!summaryText) {
        throw new Error('AI failed to generate summary text.');
    }

    const language = detectLanguage(contentToSummarize);

    // Save the summary to the database
    const result = await pool.query(
      `INSERT INTO rss.summaries (item_id, summary_text, language)
       VALUES ($1, $2, $3)
       RETURNING *`,
      [articleId, summaryText, language]
    );

    logger.info(`Successfully generated and saved summary for article ID: ${articleId}`);
    return NextResponse.json(result.rows[0], { status: 201 });

  } catch (error) {
    logger.error(`Error generating summary for article ${articleId}:`, error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to generate summary';
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
