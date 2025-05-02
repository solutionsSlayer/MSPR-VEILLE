// This page might not be strictly necessary if the summary is displayed
// within the ArticleDetail component using tabs. However, if you want a
// dedicated URL for just the summary, this component can be used.

"use client";

import React, { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import AppHeader from '@/components/AppHeader';
import { Button } from '@/components/ui/button';
import { LogOut, ArrowLeft, Headphones } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Terminal } from 'lucide-react';

interface Summary {
  id: number;
  item_id: number;
  summary_text: string;
  language: string;
  created_at: string;
}

interface ArticleInfo {
    title: string;
    published_date: string;
}

const formatDate = (dateString: string) => {
  if (!dateString) return 'Unknown date';
  return new Intl.DateTimeFormat('en-US', { dateStyle: 'medium' }).format(new Date(dateString));
};

export default function SummaryPage() {
  const params = useParams();
  const router = useRouter();
  const { logout } = useAuth();
  const articleId = Number(params.id);

  const [summary, setSummary] = useState<Summary | null>(null);
  const [articleInfo, setArticleInfo] = useState<ArticleInfo | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isGeneratingPodcast, setIsGeneratingPodcast] = useState(false);
  const [podcastUrl, setPodcastUrl] = useState<string | null>(null); // To store generated podcast URL

  useEffect(() => {
    if (isNaN(articleId)) {
      setError("Invalid Article ID");
      setIsLoading(false);
      return;
    }

    const fetchSummary = async () => {
      setIsLoading(true);
      setError(null);
      try {
        // Fetch summary and basic article info together
        const response = await fetch(`/api/articles/${articleId}`);
        if (!response.ok) {
            if (response.status === 404) throw new Error('Article not found.');
            throw new Error(`Failed to fetch data (status: ${response.status})`);
        }
        const data = await response.json();

        if (!data.article) throw new Error('Article data missing.');

        setArticleInfo({ title: data.article.title, published_date: data.article.published_date });

        if (data.summary) {
            setSummary(data.summary);
        } else {
            // If no summary, try to generate one
            const generateResponse = await fetch(`/api/articles/${articleId}/summary`, { method: 'POST' });
            if (!generateResponse.ok) {
                 const errData = await generateResponse.json();
                 throw new Error(errData.error || 'Failed to generate summary.');
            }
            const generatedSummary = await generateResponse.json();
            setSummary(generatedSummary);
        }

        // Check if podcast exists too
         if (data.podcast?.audio_file_path) {
             setPodcastUrl(data.podcast.audio_file_path);
         }

      } catch (err: any) {
        console.error("Error fetching or generating summary:", err);
        setError(err.message || 'Failed to load or generate summary.');
      } finally {
        setIsLoading(false);
      }
    };

    fetchSummary();
  }, [articleId]);

  const handleGeneratePodcast = async () => {
        if (!summary) return;
        setIsGeneratingPodcast(true);
        setError(null);
        try {
            const response = await fetch(`/api/articles/${articleId}/podcast`, { method: 'POST' });
             if (!response.ok) {
                 const errData = await response.json();
                 throw new Error(errData.error || 'Failed to generate podcast.');
             }
             const podcastData = await response.json();
             setPodcastUrl(podcastData.audio_file_path);
        } catch (err: any) {
             console.error("Error generating podcast:", err);
             setError(err.message || 'Failed to generate podcast.');
        } finally {
             setIsGeneratingPodcast(false);
        }
   };

  const renderContent = () => {
    if (isLoading) {
      return (
        <Card>
          <CardHeader>
            <Skeleton className="h-6 w-3/4 mb-2" />
            <Skeleton className="h-4 w-1/4" />
          </CardHeader>
          <CardContent className="space-y-3">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-5/6" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-3/4" />
          </CardContent>
        </Card>
      );
    }

    if (error) {
      return (
        <Alert variant="destructive">
          <Terminal className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      );
    }

    if (!summary || !articleInfo) {
      return <p>Summary or article information not available.</p>;
    }

    return (
      <Card>
        <CardHeader>
          <CardTitle>{articleInfo.title} - Summary</CardTitle>
          <CardDescription>
            Generated on {formatDate(summary.created_at)} ({summary.language.toUpperCase()})
            <br />
            Original article published on {formatDate(articleInfo.published_date)}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="whitespace-pre-line text-foreground/90 leading-relaxed">
            {summary.summary_text}
          </div>
        </CardContent>
         <CardFooter className="flex justify-between pt-6 border-t">
              {podcastUrl ? (
                   <Button variant="outline" asChild>
                        <a href={podcastUrl} target="_blank" rel="noopener noreferrer">
                             <Headphones className="h-4 w-4 mr-2" />
                             Listen to Podcast
                        </a>
                   </Button>
              ) : (
                   <Button onClick={handleGeneratePodcast} disabled={isGeneratingPodcast}>
                        {isGeneratingPodcast ? (
                             <>
                                  <Skeleton className="h-4 w-4 mr-2 animate-spin rounded-full" /> Generating...
                             </>
                        ) : (
                             <>
                                  <Headphones className="h-4 w-4 mr-2" />
                                  Generate Podcast
                             </>
                        )}
                   </Button>
              )}
              <div>{/* Placeholder for other actions if needed */}</div>
         </CardFooter>
      </Card>
    );
  };

  return (
    <div className="flex flex-col min-h-screen bg-secondary">
      <AppHeader>
        <Button variant="ghost" size="sm" onClick={logout}>
          <LogOut className="mr-2 h-4 w-4" /> Logout
        </Button>
      </AppHeader>
      <main className="flex-grow container mx-auto px-4 py-8">
        <Button variant="ghost" size="sm" onClick={() => router.back()} className="mb-4">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back
        </Button>
        {renderContent()}
      </main>
      <footer className="bg-primary text-primary-foreground py-4 mt-auto">
        <div className="container mx-auto text-center text-sm">
          QuantumWatch &copy; {new Date().getFullYear()}
        </div>
      </footer>
    </div>
  );
}
