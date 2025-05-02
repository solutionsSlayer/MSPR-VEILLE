import React, { useEffect, useState } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  ArrowLeft, 
  Globe, 
  Calendar, 
  User, 
  RefreshCw, 
  Headphones, 
  Play, 
  Pause, 
  Volume2
} from "lucide-react";
import Link from 'next/link';

interface Article {
  id: number;
  feed_id: number;
  feed_title: string;
  title: string;
  link: string;
  description: string;
  content: string;
  author: string;
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
  audio_file_path: string;
  duration: number;
  voice_id: string;
  created_at: string;
}

const formatDate = (dateString: string) => {
  if (!dateString) return 'Unknown date';
  const date = new Date(dateString);
  return new Intl.DateTimeFormat('en-US', {
    dateStyle: 'medium'
  }).format(date);
};

// Format podcast duration from seconds to mm:ss
const formatDuration = (seconds: number) => {
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
};

interface ArticleDetailProps {
  articleId: number;
}

const ArticleDetail: React.FC<ArticleDetailProps> = ({ articleId }) => {
  const [article, setArticle] = useState<Article | null>(null);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [podcast, setPodcast] = useState<Podcast | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('article');
  const [isPlaying, setIsPlaying] = useState(false);
  const [audioRef, setAudioRef] = useState<HTMLAudioElement | null>(null);

  useEffect(() => {
    const fetchArticleDetails = async () => {
      try {
        const response = await fetch(`/api/articles/${articleId}`);
        if (!response.ok) throw new Error('Failed to fetch article');
        const data = await response.json();
        setArticle(data.article);
        setSummary(data.summary);
        setPodcast(data.podcast);
      } catch (error) {
        console.error('Error fetching article details:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchArticleDetails();
  }, [articleId]);

  useEffect(() => {
    // Initialize audio player if podcast exists
    if (podcast?.audio_file_path) {
      const audio = new Audio(podcast.audio_file_path);
      audio.addEventListener('ended', () => setIsPlaying(false));
      setAudioRef(audio);
      
      return () => {
        audio.pause();
        audio.removeEventListener('ended', () => setIsPlaying(false));
      };
    }
  }, [podcast]);

  const togglePlayPause = () => {
    if (!audioRef) return;
    
    if (isPlaying) {
      audioRef.pause();
    } else {
      audioRef.play();
    }
    
    setIsPlaying(!isPlaying);
  };

  const generateSummary = async () => {
    if (!article) return;
    
    try {
      const response = await fetch(`/api/articles/${articleId}/summary`, {
        method: 'POST'
      });
      
      if (!response.ok) throw new Error('Failed to generate summary');
      
      const data = await response.json();
      setSummary(data);
    } catch (error) {
      console.error('Error generating summary:', error);
    }
  };

  const generatePodcast = async () => {
    if (!summary) return;
    
    try {
      const response = await fetch(`/api/articles/${articleId}/podcast`, {
        method: 'POST'
      });
      
      if (!response.ok) throw new Error('Failed to generate podcast');
      
      const data = await response.json();
      setPodcast(data);
    } catch (error) {
      console.error('Error generating podcast:', error);
    }
  };

  if (loading) {
    return <div className="container mx-auto py-6">Loading article details...</div>;
  }

  if (!article) {
    return <div className="container mx-auto py-6">Article not found</div>;
  }

  return (
    <div className="container mx-auto py-6">
      <div className="mb-6">
        <Link href="/articles" passHref>
          <Button variant="ghost" size="sm">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Articles
          </Button>
        </Link>
      </div>

      <div className="mb-6">
        <h1 className="text-3xl font-bold">{article.title}</h1>
        <div className="flex flex-wrap gap-3 mt-2">
          <Badge variant="outline">{article.feed_title}</Badge>
          <div className="flex items-center text-sm text-muted-foreground">
            <Calendar className="h-4 w-4 mr-1" />
            <span>{formatDate(article.published_date)}</span>
          </div>
          {article.author && (
            <div className="flex items-center text-sm text-muted-foreground">
              <User className="h-4 w-4 mr-1" />
              <span>{article.author}</span>
            </div>
          )}
          <div className="flex items-center text-sm text-muted-foreground">
            <Globe className="h-4 w-4 mr-1" />
            <a 
              href={article.link} 
              target="_blank" 
              rel="noopener noreferrer"
              className="hover:underline"
            >
              Original Article
            </a>
          </div>
        </div>
      </div>

      <Tabs defaultValue="article" onValueChange={setActiveTab}>
        <TabsList className="mb-4">
          <TabsTrigger value="article">Article</TabsTrigger>
          <TabsTrigger value="summary" disabled={!summary}>Summary</TabsTrigger>
          <TabsTrigger value="podcast" disabled={!podcast}>Podcast</TabsTrigger>
        </TabsList>

        <TabsContent value="article" className="mt-0">
          <Card>
            <CardContent className="pt-6">
              <div 
                className="prose max-w-none"
                dangerouslySetInnerHTML={{ 
                  __html: article.content || article.description 
                }}
              />
            </CardContent>
            <CardFooter className="flex justify-between pt-6 border-t">
              {!summary && (
                <Button onClick={generateSummary}>
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Generate Summary
                </Button>
              )}
              
              {summary && !podcast && (
                <Button onClick={generatePodcast}>
                  <Headphones className="h-4 w-4 mr-2" />
                  Generate Podcast
                </Button>
              )}
              
              {!summary && !podcast && <div />}
            </CardFooter>
          </Card>
        </TabsContent>

        <TabsContent value="summary" className="mt-0">
          {summary ? (
            <Card>
              <CardHeader>
                <CardTitle>AI-Generated Summary</CardTitle>
                <CardDescription>
                  Generated on {formatDate(summary.created_at)} 
                  in {summary.language.toUpperCase()}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="whitespace-pre-line">
                  {summary.summary_text}
                </div>
              </CardContent>
              <CardFooter className="flex justify-between pt-6 border-t">
                {!podcast && (
                  <Button onClick={generatePodcast}>
                    <Headphones className="h-4 w-4 mr-2" />
                    Generate Podcast
                  </Button>
                )}
              </CardFooter>
            </Card>
          ) : (
            <p>No summary available. Go to the Article tab to generate one.</p>
          )}
        </TabsContent>

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
                    >
                      {isPlaying ? (
                        <Pause className="h-4 w-4" />
                      ) : (
                        <Play className="h-4 w-4" />
                      )}
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
              </CardContent>
              <CardFooter className="pt-6 border-t">
                <a
                  href={podcast.audio_file_path}
                  download
                  className="inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 border border-input bg-background hover:bg-accent hover:text-accent-foreground h-10 px-4 py-2"
                >
                  Download Audio
                </a>
              </CardFooter>
            </Card>
          ) : (
            <p>No podcast available. Go to the Summary tab to generate one.</p>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default ArticleDetail;
