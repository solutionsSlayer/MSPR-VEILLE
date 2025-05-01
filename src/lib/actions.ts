'use server';

import type { SummarizeQuantumNewsInput, SummarizeQuantumNewsOutput } from '@/ai/flows/summarize-quantum-news';
import { summarizeQuantumNews } from '@/ai/flows/summarize-quantum-news';
// Import generatePodcastScript if needed later, currently handled within summarizeQuantumNews
// import { generatePodcastScript } from '@/ai/flows/generate-podcast-script';

/**
 * Handles the summarization of RSS items using the AI flow.
 * This function is designed to be called from client components.
 * @param input The input data containing RSS items.
 * @returns A promise that resolves with the summary and podcast URL.
 */
export async function handleSummarize(
  input: SummarizeQuantumNewsInput
): Promise<SummarizeQuantumNewsOutput> {
  try {
    // Validate input if necessary (using Zod schema from the flow could be an option)
    if (!input || !Array.isArray(input.rssItems)) {
      throw new Error('Invalid input: rssItems array is required.');
    }

    // Call the Genkit flow for summarization and podcast generation
    const result = await summarizeQuantumNews(input);

    // Optional: Further processing or logging can be done here

    return result;
  } catch (error) {
    console.error('Error in handleSummarize action:', error);
    // Re-throw the error or return a specific error structure
    throw new Error('Failed to summarize news. Please check server logs.');
  }
}
