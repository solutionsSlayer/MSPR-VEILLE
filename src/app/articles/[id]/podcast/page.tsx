// This page might not be strictly necessary if the podcast is displayed
// within the ArticleDetail component using tabs. However, if you want a
// dedicated URL for just the podcast, this component can be used.

"use client";

import React, { useEffect, useState, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import AppHeader from '@/components/AppHeader';
import { Button } from '@/components/ui/button';
import { LogOut, ArrowLeft, Play, Pause, Download, Volume2, VolumeX } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Slider } from '@/components/ui/slider';
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

// Function to sanitize filenames (was missing)
function sanitizeFilename(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
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
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(0.8);
  const [isMuted, setIsMuted] = useState(false);
  const [audioData, setAudioData] = useState<number[]>([]);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animationRef = useRef<number | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

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
      audio.addEventListener('timeupdate', () => setCurrentTime(audio.currentTime));
      audio.addEventListener('loadedmetadata', () => setDuration(audio.duration));
      
      // Set initial volume
      audio.volume = volume;
      
      audioRef.current = audio;

      return () => {
        audio.pause();
        audio.removeEventListener('play', () => setIsPlaying(true));
        audio.removeEventListener('pause', () => setIsPlaying(false));
        audio.removeEventListener('ended', () => setIsPlaying(false));
        audio.removeEventListener('timeupdate', () => setCurrentTime(audio.currentTime));
        audio.removeEventListener('loadedmetadata', () => setDuration(audio.duration));
        
        if (audioContextRef.current) {
          audioContextRef.current.close();
        }
        
        audioRef.current = null; // Clean up ref
      };
    }
  }, [podcast, volume]);

  // Separate effect for visualization setup
  useEffect(() => {
    if (audioRef.current && !audioContextRef.current) {
      setupAudioVisualization();
    }

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
        animationRef.current = null;
      }
    };
  }, [audioRef.current]);

  // Effect to handle animation when playing status changes
  useEffect(() => {
    if (isPlaying && audioContextRef.current && analyserRef.current) {
      if (audioContextRef.current.state === 'suspended') {
        audioContextRef.current.resume();
      }
      visualize();
    } else if (!isPlaying && animationRef.current) {
      cancelAnimationFrame(animationRef.current);
      animationRef.current = null;
    }
  }, [isPlaying]);

  const setupAudioVisualization = () => {
    if (!audioRef.current || audioContextRef.current) return;

    try {
      // Create audio context
      const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioContext) {
        console.error("AudioContext not supported in this browser");
        return;
      }

      audioContextRef.current = new AudioContext();
      
      // Create analyzer node
      analyserRef.current = audioContextRef.current.createAnalyser();
      analyserRef.current.fftSize = 256; // Power of 2, between 32-2048
      
      // Connect audio to analyzer
      const source = audioContextRef.current.createMediaElementSource(audioRef.current);
      source.connect(analyserRef.current);
      analyserRef.current.connect(audioContextRef.current.destination);

      // We'll start visualization when playing begins
    } catch (err) {
      console.error("Audio visualization setup failed:", err);
    }
  };

  const visualize = () => {
    if (!analyserRef.current || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const analyser = analyserRef.current;
    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);

    const draw = () => {
      animationRef.current = requestAnimationFrame(draw);
      
      if (!ctx || !analyser || !isPlaying) return;
      
      analyser.getByteFrequencyData(dataArray);
      
      // Clear canvas
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      
      // Set visualization style
      ctx.fillStyle = '#10b981'; // emerald/green color
      
      const barWidth = (canvas.width / bufferLength) * 2.5;
      let x = 0;
      
      // Draw bars for frequency data
      for (let i = 0; i < bufferLength; i++) {
        const barHeight = (dataArray[i] / 255) * canvas.height * 0.8;
        
        // Only draw every few bars to make it less crowded
        if (i % 2 === 0) {
          ctx.fillRect(x, canvas.height - barHeight, barWidth, barHeight);
        }
        
        x += barWidth + 1;
      }
    };

    // Start drawing
    draw();
  };

  const togglePlayPause = () => {
    if (!audioRef.current) return;
    
    if (isPlaying) {
      audioRef.current.pause();
    } else {
      if (audioContextRef.current?.state === 'suspended') {
        audioContextRef.current.resume();
      }
      audioRef.current.play().catch(e => console.error("Error playing audio:", e));
    }
  };

  const handleTimeChange = (value: number[]) => {
    if (!audioRef.current) return;
    audioRef.current.currentTime = value[0];
    setCurrentTime(value[0]);
  };

  const handleVolumeChange = (value: number[]) => {
    if (!audioRef.current) return;
    const newVolume = value[0];
    setVolume(newVolume);
    audioRef.current.volume = newVolume;
    
    // Update muted state
    if (newVolume === 0) {
      setIsMuted(true);
    } else if (isMuted) {
      setIsMuted(false);
    }
  };

  const toggleMute = () => {
    if (!audioRef.current) return;
    
    if (isMuted) {
      audioRef.current.volume = volume || 0.5;
      setIsMuted(false);
    } else {
      audioRef.current.volume = 0;
      setIsMuted(true);
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
            <Skeleton className="h-40 w-full mt-4" />
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
        <CardContent className="space-y-6">
          <div className="bg-muted rounded-lg p-4 flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <Button
                variant="outline"
                size="icon"
                onClick={togglePlayPause}
                aria-label={isPlaying ? "Pause podcast" : "Play podcast"}
                className="h-10 w-10"
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
            <button 
              onClick={toggleMute} 
              className="p-2 rounded-full hover:bg-primary/10"
              aria-label={isMuted ? "Unmute" : "Mute"}
            >
              {isMuted ? 
                <VolumeX className="h-5 w-5 text-muted-foreground" /> : 
                <Volume2 className="h-5 w-5 text-muted-foreground" />
              }
            </button>
          </div>
          
          {/* Playback controls */}
          <div className="space-y-4">
            <div className="flex justify-between text-sm">
              <span>{formatDuration(currentTime)}</span>
              <span>{formatDuration(duration)}</span>
            </div>
            <Slider
              value={[currentTime]}
              max={duration || 100}
              step={0.1}
              onValueChange={handleTimeChange}
              aria-label="Playback position"
            />
          </div>
          
          {/* Volume control */}
          <div className="flex items-center space-x-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={toggleMute}
              aria-label={isMuted ? "Unmute" : "Mute"}
            >
              {isMuted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
            </Button>
            <Slider
              value={[isMuted ? 0 : volume]}
              max={1}
              step={0.01}
              onValueChange={handleVolumeChange}
              className="w-28"
              aria-label="Volume"
            />
          </div>
          
          {/* Audio visualization */}
          <div className="bg-black/5 dark:bg-white/5 rounded-lg p-2 h-48 flex items-center justify-center">
            <canvas 
              ref={canvasRef} 
              className="w-full h-full"
              width={500}
              height={150}
              style={{ display: isPlaying ? 'block' : 'none' }}
            />
            {!isPlaying && (
              <div className="flex flex-row items-center justify-center w-full h-full">
                {/* Static waveforms when not playing */}
                {Array.from({ length: 30 }).map((_, i) => (
                  <div 
                    key={i}
                    className="bg-primary/60 mx-0.5 rounded-sm w-2"
                    style={{ 
                      height: `${10 + Math.sin(i * 0.8) * 30 + Math.random() * 20}px`
                    }}
                  />
                ))}
              </div>
            )}
          </div>
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
