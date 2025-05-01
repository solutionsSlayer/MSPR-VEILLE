"use client";

import React, { useState, useEffect, useTransition } from 'react';
import type { RssItem } from '@/services/rss-feed';
import { getRssFeedItems } from '@/services/rss-feed';
import type { SummarizeQuantumNewsOutput } from '@/ai/flows/summarize-quantum-news';
import { handleSummarize } from '@/lib/actions'; // Updated import path
import AppHeader from '@/components/quantum-watch/header';
import NewsFeed from '@/components/quantum-watch/news-feed';
import SummarizeButton from '@/components/quantum-watch/summarize-button';
import SummaryDisplay from '@/components/quantum-watch/summary-display';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Terminal } from 'lucide-react';
import { useToast } from "@/hooks/use-toast";

// Define the RSS feed URL (can be moved to config later)
const QUANTUM_NEWS_FEED_URL = 'https://phys.org/rss-feed/quantum-physics-news/'; // Example feed

export default function Home() {
  const [rssItems, setRssItems] = useState<RssItem[]>([]);
  const [summaryData, setSummaryData] = useState<SummarizeQuantumNewsOutput | null>(null);
  const [isLoadingFeed, setIsLoadingFeed] = useState(true);
  const [errorFeed, setErrorFeed] = useState<string | null>(null);
  const [isSummarizing, startTransition] = useTransition();
  const { toast } = useToast();

  useEffect(() => {
    async function fetchFeed() {
      setIsLoadingFeed(true);
      setErrorFeed(null);
      try {
        // In a real app, pass the actual URL
        // const items = await getRssFeedItems(QUANTUM_NEWS_FEED_URL);
        // Using placeholder data for now as getRssFeedItems is not implemented
        const items = await getRssFeedItems("placeholder_url");
        setRssItems(items);
      } catch (err) {
        console.error('Error fetching RSS feed:', err);
        setErrorFeed('Failed to load the news feed. Please try again later.');
        toast({
          variant: "destructive",
          title: "Error",
          description: "Failed to load the news feed.",
        });
      } finally {
        setIsLoadingFeed(false);
      }
    }
    fetchFeed();
  }, [toast]); // Added toast to dependency array

  const onSummarize = () => {
    startTransition(async () => {
      try {
        const result = await handleSummarize({ rssItems });
        setSummaryData(result);
        toast({
          title: "Summarization Complete",
          description: "The news has been summarized and sent.",
        });
      } catch (error) {
        console.error('Error summarizing news:', error);
        setSummaryData(null); // Clear previous summary on error
        toast({
          variant: "destructive",
          title: "Summarization Failed",
          description: "Could not generate summary. Please try again.",
        });
      }
    });
  };

  return (
    <div className="flex flex-col min-h-screen bg-secondary">
      <AppHeader />
      <main className="flex-grow container mx-auto px-4 py-8">
        <div className="mb-8 flex justify-end">
          <SummarizeButton onClick={onSummarize} isLoading={isSummarizing} disabled={isLoadingFeed || rssItems.length === 0}/>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2">
            <h2 className="text-2xl font-semibold mb-4 text-primary">Quantum News Feed</h2>
            {isLoadingFeed ? (
              <FeedSkeleton />
            ) : errorFeed ? (
              <ErrorAlert message={errorFeed} />
            ) : (
              <NewsFeed items={rssItems} />
            )}
          </div>
          <div className="lg:col-span-1">
             <h2 className="text-2xl font-semibold mb-4 text-primary">Summary & Podcast</h2>
            <SummaryDisplay summaryData={summaryData} isLoading={isSummarizing} />
          </div>
        </div>
      </main>
       <footer className="bg-primary text-primary-foreground py-4 mt-auto">
        <div className="container mx-auto text-center text-sm">
          QuantumWatch &copy; {new Date().getFullYear()}
        </div>
      </footer>
    </div>
  );
}

// Skeleton Loader for News Feed
const FeedSkeleton = () => (
  <div className="space-y-4">
    {[...Array(5)].map((_, i) => (
      <div key={i} className="p-4 border rounded-lg shadow-sm bg-card">
        <Skeleton className="h-6 w-3/4 mb-2" />
        <Skeleton className="h-4 w-full mb-1" />
        <Skeleton className="h-4 w-5/6 mb-3" />
        <Skeleton className="h-4 w-1/4" />
      </div>
    ))}
  </div>
);

// Error Alert Component
const ErrorAlert = ({ message }: { message: string }) => (
  <Alert variant="destructive">
    <Terminal className="h-4 w-4" />
    <AlertTitle>Error</AlertTitle>
    <AlertDescription>{message}</AlertDescription>
  </Alert>
);