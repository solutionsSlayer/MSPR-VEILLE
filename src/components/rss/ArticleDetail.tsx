import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  ArrowLeft, Globe, Calendar, User, RefreshCw, Headphones, Play, Pause, Volume2, FileText, Download, AlertTriangle, Loader2,
} from "lucide-react";
import Link from 'next/link';
import { useToast } from '@/hooks/use-toast';

interface Article {
  id: number;
  feed_id: number;
  feed_title: string;
  title: string;
  link: string;
  description: string;
  content: string;
  author: string | null;
  published_date: string;
  is_read: boolean;
  is_bookmarked: boolean;
}

interface Summary {
  id: number;
  item_id: number;
  summary_text: string;
  language: string;
  created_at: string;
}

interface Podcast {
  id: number;
  item_id: number;
  summary_id: number;
  audio_file_path: string; // Should be a URL path like /podcasts/...
  duration: number | null;
  voice_id: string;
  created_at: string;
}

const formatDate = (dateString: string) => {
  if (!dateString) return 'Unknown date';
   try {
       const date = new Date(dateString);
       if (isNaN(date.getTime())) return 'Invalid date';
       return new Intl.DateTimeFormat('en-US', {
         year: 'numeric', month: 'short', day: 'numeric'
       }).format(date);
   } catch (e) {
       return 'Invalid date';
   }
};

const formatDuration = (seconds: number | null | undefined): string => {
    if (seconds === null || seconds === undefined || isNaN(seconds)) return '--:--';
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.floor(seconds % 60);
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
};

// Function to sanitize filenames (if needed for download attribute)
function sanitizeFilename(name: string): string {
  return name.trim().toLowerCase().replace(/[^\w\s-]/g, '').replace(/[\s_-]+/g, '-').replace(/^-+|-+$/g, '');
}


interface ArticleDetailProps {
  articleId: number;
}

const ArticleDetail: React.FC<ArticleDetailProps> = ({ articleId }) => {
  const [article, setArticle] = useState<Article | null>(null);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [podcast, setPodcast] = useState<Podcast | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('article');
  const [isGeneratingSummary, setIsGeneratingSummary] = useState(false);
  const [isGeneratingPodcast, setIsGeneratingPodcast] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const { toast } = useToast();

  const fetchArticleDetails = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/articles/${articleId}`);
       if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.error || `Failed to fetch article (status: ${response.status})`);
       }
      const data = await response.json();
      setArticle(data.article);
      setSummary(data.summary);
      setPodcast(data.podcast);
    } catch (err: any) {
      console.error('Error fetching article details:', err);
      setError(err.message || 'Failed to load article details.');
        toast({ variant: "destructive", title: "Loading Error", description: err.message });
    } finally {
      setLoading(false);
    }
  }, [articleId, toast]); // Added toast to dependencies

  useEffect(() => {
    fetchArticleDetails();
  }, [fetchArticleDetails]);

   // Effect to setup audio player
   useEffect(() => {
     if (podcast?.audio_file_path && !audioRef.current) {
       const audio = new Audio(podcast.audio_file_path);
       audio.addEventListener('play', () => setIsPlaying(true));
       audio.addEventListener('pause', () => setIsPlaying(false));
       audio.addEventListener('ended', () => setIsPlaying(false));
       audioRef.current = audio;

       return () => { // Cleanup function
         audio.pause();
         audio.removeEventListener('play', () => setIsPlaying(true));
         audio.removeEventListener('pause', () => setIsPlaying(false));
         audio.removeEventListener('ended', () => setIsPlaying(false));
         audioRef.current = null;
       };
     }
      // Reset audio ref if podcast becomes null
      if (!podcast && audioRef.current) {
           audioRef.current.pause();
           audioRef.current = null;
           setIsPlaying(false);
      }
   }, [podcast]); // Depend on podcast state

  const togglePlayPause = () => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
    } else {
      audioRef.current.play().catch(e => {
          console.error("Audio play failed:", e);
          toast({ variant: "destructive", title: "Audio Error", description: "Could not play audio." });
      });
    }
     // State update is handled by event listeners 'play' and 'pause'
  };


  const generateSummary = async () => {
    if (!article || isGeneratingSummary) return;
    setIsGeneratingSummary(true);
    setError(null); // Clear previous errors specific to generation

    try {
      const response = await fetch(`/api/articles/${articleId}/summary`, { method: 'POST' });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Failed to generate summary');
      }
      setSummary(data);
      setActiveTab('summary'); // Switch to summary tab after generation
       toast({ title: "Summary Generated", description: "AI summary successfully created." });
    } catch (err: any) {
      console.error('Error generating summary:', err);
      setError(`Summary generation failed: ${err.message}`);
        toast({ variant: "destructive", title: "Summary Generation Failed", description: err.message });
    } finally {
      setIsGeneratingSummary(false);
    }
  };

  const generatePodcast = async () => {
    if (!summary || !article || isGeneratingPodcast) return;
    setIsGeneratingPodcast(true);
    setError(null); // Clear previous errors specific to generation

    try {
      const response = await fetch(`/api/articles/${articleId}/podcast`, { method: 'POST' });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Failed to generate podcast');
      }
      setPodcast(data);
       // Reset audio ref to force re-initialization with new podcast data/URL
        if (audioRef.current) {
            audioRef.current.pause();
            audioRef.current = null;
            setIsPlaying(false);
        }
      setActiveTab('podcast'); // Switch to podcast tab after generation
       toast({ title: "Podcast Generated", description: "Audio podcast successfully created." });
    } catch (err: any) {
      console.error('Error generating podcast:', err);
      setError(`Podcast generation failed: ${err.message}`);
        toast({ variant: "destructive", title: "Podcast Generation Failed", description: err.message });
    } finally {
      setIsGeneratingPodcast(false);
    }
  };

  if (loading) {
    return (
       <div className="container mx-auto py-6 space-y-6">
            <Skeleton className="h-8 w-40 mb-6" /> {/* Back button skeleton */}
            <Skeleton className="h-10 w-3/4 mb-2" /> {/* Title skeleton */}
            <div className="flex flex-wrap gap-3 mt-2 mb-6">
                <Skeleton className="h-6 w-24" />
                <Skeleton className="h-6 w-32" />
                <Skeleton className="h-6 w-28" />
                <Skeleton className="h-6 w-24" />
            </div>
             <Skeleton className="h-10 w-64 mb-4" /> {/* Tabs List skeleton */}
             <Card> {/* Skeleton for Card content */}
                 <CardContent className="pt-6 space-y-4">
                     <Skeleton className="h-4 w-full" />
                     <Skeleton className="h-4 w-full" />
                     <Skeleton className="h-4 w-5/6" />
                     <Skeleton className="h-4 w-full" />
                      <Skeleton className="h-4 w-3/4" />
                 </CardContent>
             </Card>
       </div>
    );
  }

  if (error && !article) { // Show main error only if article failed to load
     return (
          <div className="container mx-auto py-6">
               <Button variant="ghost" size="sm" onClick={() => window.history.back()} className="mb-4">
                 <ArrowLeft className="h-4 w-4 mr-2" /> Back
               </Button>
               <Alert variant="destructive">
                 <AlertTriangle className="h-4 w-4" />
                 <AlertTitle>Error Loading Article</AlertTitle>
                 <AlertDescription>{error}</AlertDescription>
               </Alert>
          </div>
     );
   }


  if (!article) {
    // Should have been caught by error state, but as a fallback
    return <div className="container mx-auto py-6">Article not found</div>;
  }

  return (
    <div className="container mx-auto py-6">
      <div className="mb-6">
        {/* Use NextLink for internal navigation */}
        <Link href="/articles" passHref>
          <Button variant="ghost" size="sm">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Articles
          </Button>
        </Link>
      </div>

       {error && ( // Display non-critical errors here (e.g., generation errors)
            <Alert variant="destructive" className="mb-4">
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>Operation Error</AlertTitle>
                <AlertDescription>{error}</AlertDescription>
            </Alert>
       )}


      <div className="mb-6">
        <h1 className="text-2xl md:text-3xl font-bold break-words">{article.title}</h1>
        <div className="flex flex-wrap gap-x-4 gap-y-2 mt-2 text-sm text-muted-foreground">
          <Badge variant="outline">{article.feed_title}</Badge>
          <div className="flex items-center gap-1.5">
            <Calendar className="h-4 w-4" />
            <span>{formatDate(article.published_date)}</span>
          </div>
          {article.author && (
            <div className="flex items-center gap-1.5">
              <User className="h-4 w-4" />
              <span>{article.author}</span>
            </div>
          )}
          <a
            href={article.link}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 text-accent hover:underline"
          >
            <Globe className="h-4 w-4" />
            <span>Original Article</span>
          </a>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="mb-4">
          <TabsTrigger value="article">Article</TabsTrigger>
          <TabsTrigger value="summary">
              <FileText className="h-4 w-4 mr-2"/>Summary {isGeneratingSummary && <Loader2 className="h-4 w-4 ml-2 animate-spin"/>}
          </TabsTrigger>
          <TabsTrigger value="podcast" disabled={!summary}> {/* Disable podcast tab if no summary */}
               <Headphones className="h-4 w-4 mr-2"/>Podcast {isGeneratingPodcast && <Loader2 className="h-4 w-4 ml-2 animate-spin"/>}
          </TabsTrigger>
        </TabsList>

        {/* Article Content */}
        <TabsContent value="article" className="mt-0">
          <Card>
            <CardContent className="pt-6">
              {/* Be cautious with dangerouslySetInnerHTML. Consider sanitization. */}
              <div
                className="prose dark:prose-invert max-w-none prose-sm sm:prose-base"
                dangerouslySetInnerHTML={{
                  __html: article.content || article.description || '<p>No content available.</p>'
                }}
              />
            </CardContent>
             {!summary && ( // Show generate summary button only if no summary exists
                 <CardFooter className="pt-6 border-t">
                     <Button onClick={generateSummary} disabled={isGeneratingSummary}>
                       {isGeneratingSummary ? (
                           <> <Loader2 className="h-4 w-4 mr-2 animate-spin"/> Generating... </>
                       ) : (
                           <> <RefreshCw className="h-4 w-4 mr-2" /> Generate Summary </>
                       )}
                     </Button>
                 </CardFooter>
             )}
          </Card>
        </TabsContent>

        {/* Summary Content */}
        <TabsContent value="summary" className="mt-0">
          {summary ? (
            <Card>
              <CardHeader>
                <CardTitle>AI-Generated Summary</CardTitle>
                <CardDescription>
                  Generated on {formatDate(summary.created_at)}
                  {summary.language && ` (${summary.language.toUpperCase()})`}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="whitespace-pre-wrap text-foreground/90 leading-relaxed">
                  {summary.summary_text}
                </div>
              </CardContent>
              {!podcast && ( // Show generate podcast button only if no podcast exists
                 <CardFooter className="pt-6 border-t">
                     <Button onClick={generatePodcast} disabled={isGeneratingPodcast}>
                         {isGeneratingPodcast ? (
                              <> <Loader2 className="h-4 w-4 mr-2 animate-spin"/> Generating... </>
                         ) : (
                              <> <Headphones className="h-4 w-4 mr-2" /> Generate Podcast </>
                         )}
                     </Button>
                 </CardFooter>
               )}
            </Card>
          ) : (
            <Card className="text-center py-12">
                <CardContent>
                    <p className="text-muted-foreground">Summary not yet generated.</p>
                    <Button onClick={generateSummary} disabled={isGeneratingSummary} className="mt-4">
                       {isGeneratingSummary ? (
                           <> <Loader2 className="h-4 w-4 mr-2 animate-spin"/> Generating... </>
                       ) : (
                           <> <RefreshCw className="h-4 w-4 mr-2" /> Generate Summary Now </>
                       )}
                    </Button>
                </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Podcast Content */}
        <TabsContent value="podcast" className="mt-0">
          {podcast ? (
            <Card>
              <CardHeader>
                <CardTitle>Audio Podcast</CardTitle>
                <CardDescription>
                  Generated on {formatDate(podcast.created_at)}
                  {podcast.duration && ` • ${formatDuration(podcast.duration)}`}
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
                 {/* Add audio player controls like progress bar here later */}
              </CardContent>
              <CardFooter className="pt-6 border-t">
                <Button variant="outline" asChild>
                  <a
                    href={podcast.audio_file_path}
                    download={`${sanitizeFilename(article.title || 'podcast')}.mp3`}
                  >
                    <Download className="h-4 w-4 mr-2" />
                    Download Audio
                  </a>
                </Button>
              </CardFooter>
            </Card>
          ) : (
             <Card className="text-center py-12">
                 <CardContent>
                     <p className="text-muted-foreground">Podcast not yet generated.</p>
                     <Button onClick={generatePodcast} disabled={isGeneratingPodcast || !summary} className="mt-4">
                        {isGeneratingPodcast ? (
                            <> <Loader2 className="h-4 w-4 mr-2 animate-spin"/> Generating... </>
                        ) : (
                            <> <Headphones className="h-4 w-4 mr-2" /> Generate Podcast Now </>
                        )}
                     </Button>
                      {!summary && <p className="text-xs text-destructive mt-2">A summary must be generated first.</p>}
                 </CardContent>
             </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default ArticleDetail;
