'use server';

/**
 * @fileOverview Generates a podcast script based on a summary of quantum cryptography news.
 *
 * - generatePodcastScript - A function that generates a podcast script.
 * - GeneratePodcastScriptInput - The input type for the generatePodcastScript function.
 * - GeneratePodcastScriptOutput - The return type for the generatePodcastScript function.
 */

import {ai} from '@/ai/ai-instance';
import {z} from 'genkit';

const GeneratePodcastScriptInputSchema = z.string().describe('A summary of quantum cryptography news.');
export type GeneratePodcastScriptInput = z.infer<typeof GeneratePodcastScriptInputSchema>;

const GeneratePodcastScriptOutputSchema = z.string().describe('A podcast script based on the summary.');
export type GeneratePodcastScriptOutput = z.infer<typeof GeneratePodcastScriptOutputSchema>;

export async function generatePodcastScript(input: GeneratePodcastScriptInput): Promise<GeneratePodcastScriptOutput> {
  return generatePodcastScriptFlow(input);
}

const podcastScriptPrompt = ai.definePrompt({
  name: 'podcastScriptPrompt',
  input: {
    schema: z.string().describe('A summary of quantum cryptography news.'),
  },
  output: {
    schema: z.string().describe('A podcast script based on the summary.'),
  },
  prompt: `You are a podcast script writer specializing in quantum cryptography. Based on the following summary, create a short and engaging podcast script:

Summary: {{{input}}}

Podcast Script:`,
});

const generatePodcastScriptFlow = ai.defineFlow<
  typeof GeneratePodcastScriptInputSchema,
  typeof GeneratePodcastScriptOutputSchema
>(
  {
    name: 'generatePodcastScriptFlow',
    inputSchema: GeneratePodcastScriptInputSchema,
    outputSchema: GeneratePodcastScriptOutputSchema,
  },
  async input => {
    const {output} = await podcastScriptPrompt(input);
    return output!;
  }
);
