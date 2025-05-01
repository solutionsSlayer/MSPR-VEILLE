'use server';

/**
 * @fileOverview Summarizes quantum cryptography news from RSS feeds.
 *
 * - summarizeQuantumNews - A function that summarizes quantum news.
 * - SummarizeQuantumNewsInput - The input type for the summarizeQuantumNews function.
 * - SummarizeQuantumNewsOutput - The return type for the summarizeQuantumNews function.
 */

import {ai} from '@/ai/ai-instance';
import type {RssItem} from '@/services/rss-feed';
import {sendMessageToTelegram} from '@/services/telegram';
import {generatePodcastAudio} from '@/services/elevenlabs';
import {z} from 'genkit';

// Using refine to ensure there's at least one item
const RssItemSchema = z.object({
  title: z.string(),
  link: z.string().url(), // Ensure link is a valid URL
  description: z.string().optional(),
  pubDate: z.string().optional(), // Consider using z.date() if parsing dates
});

const SummarizeQuantumNewsInputSchema = z.object({
  rssItems: z
    .array(RssItemSchema)
    .min(1, { message: "At least one RSS item is required for summarization."}) // Ensure array is not empty
    .describe('Array of RSS feed items about quantum computing and cryptography.'),
});
export type SummarizeQuantumNewsInput = z.infer<typeof SummarizeQuantumNewsInputSchema>;

const SummarizeQuantumNewsOutputSchema = z.object({
  summary: z.string().describe('A concise and informative summary of the key developments in quantum computing and cryptography from the provided news items.'),
  podcastUrl: z.string().url().describe('The URL of the generated podcast audio file based on the summary.'),
});
export type SummarizeQuantumNewsOutput = z.infer<typeof SummarizeQuantumNewsOutputSchema>;

export async function summarizeQuantumNews(
  input: SummarizeQuantumNewsInput
): Promise<SummarizeQuantumNewsOutput> {
    // Validate input using Zod schema before processing
    const validationResult = SummarizeQuantumNewsInputSchema.safeParse(input);
    if (!validationResult.success) {
        console.error("Input validation failed:", validationResult.error.errors);
        throw new Error(`Invalid input: ${validationResult.error.errors.map(e => e.message).join(', ')}`);
    }
  return summarizeQuantumNewsFlow(validationResult.data); // Use validated data
}

const summarizeNewsPrompt = ai.definePrompt({
  name: 'summarizeNewsPrompt',
  input: {
    schema: SummarizeQuantumNewsInputSchema, // Use the refined input schema
  },
  output: {
    schema: z.object({ // Output schema only needs the summary string
      summary: z.string().describe('A concise and informative summary of the key developments in quantum computing and cryptography from the provided news items.'),
    }),
  },
  // Refined prompt for better summary quality
  prompt: `You are an expert analyst specializing in quantum technology. Analyze the following news items about quantum computing and cryptography. Provide a concise summary (around 150-200 words) highlighting the most significant breakthroughs, trends, or updates. Focus on clarity and impact.

News Items:
{{#each rssItems}}
- Title: {{{title}}}
  Link: {{{link}}}
  {{#if description}}Description: {{{description}}}{{/if}}
  {{#if pubDate}}Published: {{{pubDate}}}{{/if}}
{{/each}}

Generate the summary below:
Summary:`,
});

const summarizeQuantumNewsFlow = ai.defineFlow<
  typeof SummarizeQuantumNewsInputSchema,
  typeof SummarizeQuantumNewsOutputSchema
>(
  {
    name: 'summarizeQuantumNewsFlow',
    inputSchema: SummarizeQuantumNewsInputSchema,
    outputSchema: SummarizeQuantumNewsOutputSchema,
  },
  async input => {
    try {
        const {output} = await summarizeNewsPrompt(input);

        if (!output?.summary) {
          throw new Error('AI failed to generate a summary.');
        }

        // Generate podcast audio from the summary
        let podcastUrl = '';
        try {
             podcastUrl = await generatePodcastAudio(output.summary);
        } catch (podcastError) {
            console.error("Error generating podcast audio:", podcastError);
            // Decide how to handle: throw error, or continue without podcast?
            // For now, let's log and continue, returning an empty URL or default
            podcastUrl = 'error_generating_podcast'; // Or some indicator
        }


        // Send summary to Telegram channel
        try {
            await sendMessageToTelegram(`QuantumWatch Summary:\n\n${output.summary}\n\nPodcast: ${podcastUrl !== 'error_generating_podcast' ? podcastUrl : 'Not available'}`);
        } catch (telegramError) {
             console.error("Error sending message to Telegram:", telegramError);
             // Log error but don't fail the whole flow
        }


        return {summary: output.summary, podcastUrl};

    } catch(error) {
        console.error("Error in summarizeQuantumNewsFlow:", error);
        // Rethrow a more specific error or handle it
        throw new Error(`Summarization flow failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
);
