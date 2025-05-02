// This page might not be strictly necessary if the podcast is displayed
// within the ArticleDetail component using tabs. However, if you want a
// dedicated URL for just the podcast, this component can be used.

"use client";

import React, { useEffect, useState, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import AppHeader from '@/components/AppHeader';
import { Button } from '@/components/ui/button';
import { LogOut, ArrowLeft, Play, Pause, Download, Headphones, Volume2 } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Terminal } from 'lucide-react';

interface Podcast {
  id: number;
  item_id: number;
  summary_id: number;
  audio_file_path: string;
  duration: number;
  voice_id: string;
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

const formatDuration = (seconds: number | null | undefined): string => {
    if (seconds === null || seconds === undefined || isNaN(seconds)) return '--:--';
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.floor(seconds % 60);
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
};

export default function PodcastPage() {
  const params = useParams();
  const router = useRouter();
  const { logout } = useAuth();
  const articleId = Number(params.id);

  const [podcast, setPodcast] = useState<Podcast | null>(null);
  const [articleInfo, setArticleInfo] = useState<ArticleInfo | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);


  useEffect(() => {
    if (isNaN(articleId)) {
      setError("Invalid Article ID");
      setIsLoading(false);
      return;
    }

    const fetchPodcast = async () => {
      setIsLoading(true);
      setError(null);
      try {
        // Fetch podcast and basic article info together
        const response = await fetch(`/api/articles/${articleId}`);
         if (!response.ok) {
            if (response.status === 404) throw new Error('Article not found.');
            throw new Error(`Failed to fetch data (status: ${response.status})`);
        }
        const data = await response.json();

        if (!data.article) throw new Error('Article data missing.');
        setArticleInfo({ title: data.article.title, published_date: data.article.published_date });

        if (data.podcast) {
            setPodcast(data.podcast);
        } else {
             // If no podcast, try to generate one (requires summary first)
             const generateResponse = await fetch(`/api/articles/${articleId}/podcast`, { method: 'POST' });
             if (!generateResponse.ok) {
                  const errData = await generateResponse.json();
                   if (generateResponse.status === 404) { // Specific check for missing summary
                        throw new Error('Cannot generate podcast: Summary not found. Please generate summary first.');
                   }
                  throw new Error(errData.error || 'Failed to generate podcast.');
             }
             const generatedPodcast = await generateResponse.json();
             setPodcast(generatedPodcast);
        }

      } catch (err: any) {
        console.error("Error fetching or generating podcast:", err);
        setError(err.message || 'Failed to load or generate podcast.');
      } finally {
        setIsLoading(false);
      }
    };

    fetchPodcast();
  }, [articleId]);

   // Effect to setup audio player when podcast data is available
   useEffect(() => {
     if (podcast?.audio_file_path && !audioRef.current) {
       const audio = new Audio(podcast.audio_file_path);
       audio.addEventListener('play', () => setIsPlaying(true));
       audio.addEventListener('pause', () => setIsPlaying(false));
       audio.addEventListener('ended', () => setIsPlaying(false));
       audioRef.current = audio;

       return () => {
         audio.pause();
         audio.removeEventListener('play', () => setIsPlaying(true));
         audio.removeEventListener('pause', () => setIsPlaying(false));
         audio.removeEventListener('ended', () => setIsPlaying(false));
         audioRef.current = null; // Clean up ref
       };
     }
   }, [podcast]);

   const togglePlayPause = () => {
     if (!audioRef.current) return;
     if (isPlaying) {
       audioRef.current.pause();
     } else {
       audioRef.current.play().catch(e => console.error("Error playing audio:", e)); // Add catch for play promise
     }
     // State update is handled by event listeners
   };


  const renderContent = () => {
    if (isLoading) {
      return (
        <Card>
          <CardHeader>
            <Skeleton className="h-6 w-3/4 mb-2" />
            <Skeleton className="h-4 w-1/4" />
          </CardHeader>
          <CardContent>
             <div className="bg-muted rounded-lg p-4 flex items-center justify-between">
                 <div className="flex items-center space-x-4">
                     <Skeleton className="h-10 w-10 rounded-md" />
                      <div>
                          <Skeleton className="h-5 w-32 mb-1" />
                          <Skeleton className="h-4 w-24" />
                      </div>
                 </div>
                  <Skeleton className="h-6 w-6 rounded-full" />
             </div>
          </CardContent>
           <CardFooter className="pt-6 border-t">
                <Skeleton className="h-10 w-32" />
           </CardFooter>
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

    if (!podcast || !articleInfo) {
      return <p>Podcast or article information not available.</p>;
    }

    return (
      <Card>
        <CardHeader>
          <CardTitle>{articleInfo.title} - Podcast</CardTitle>
          <CardDescription>
            Generated on {formatDate(podcast.created_at)}
            {podcast.duration && ` • Duration: ${formatDuration(podcast.duration)}`}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="bg-muted rounded-lg p-4 flex items-center justify-between">
             <div className="flex items-center space-x-4">
               <Button
                 variant="outline"
                 size="icon"
                 onClick={togglePlayPause}
                 aria-label={isPlaying ? "Pause podcast" : "Play podcast"}
               >
                 {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
               </Button>
               <div>
                 <p className="font-medium">Listen to Summary</p>
                 <p className="text-sm text-muted-foreground">
                   Powered by ElevenLabs
                 </p>
               </div>
             </div>
             <Volume2 className="h-6 w-6 text-muted-foreground" />
           </div>
            {/* Consider adding playback progress bar here */}
        </CardContent>
        <CardFooter className="pt-6 border-t">
           <Button variant="outline" asChild>
             <a href={podcast.audio_file_path} download={`${sanitizeFilename(articleInfo.title || 'podcast')}.mp3`}>
               <Download className="h-4 w-4 mr-2" />
               Download Audio
             </a>
           </Button>
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
