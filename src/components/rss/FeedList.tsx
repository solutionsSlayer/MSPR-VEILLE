import React, { useEffect, useState, useCallback } from 'react';
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
import { Rss, RefreshCw, Newspaper, PlusCircle, AlertTriangle } from "lucide-react";
import Link from 'next/link';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { toast } from '@/hooks/use-toast'; // Import toast

interface Feed {
  id: number;
  title: string;
  url: string;
  description: string;
  language: string;
  category: string;
  last_fetched: string | null; // Can be null if never fetched
  active: boolean;
}

const formatDate = (dateString: string | null) => {
  if (!dateString) return 'Never';
   try {
       const date = new Date(dateString);
       if (isNaN(date.getTime())) return 'Invalid date';
       return new Intl.DateTimeFormat('en-US', {
         year: 'numeric', month: 'short', day: 'numeric',
         hour: 'numeric', minute: 'numeric'
       }).format(date);
   } catch (e) {
       console.error("Error formatting date:", dateString, e);
       return 'Invalid date';
   }
};

const FeedList = () => {
  const [feeds, setFeeds] = useState<Feed[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshingFeedId, setRefreshingFeedId] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState('all');

   const fetchFeeds = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
          const response = await fetch('/api/feeds');
           if (!response.ok) {
                const errorData = await response.json().catch(() => ({ error: 'Failed to fetch feeds' }));
                throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
           }
          const data = await response.json();
          setFeeds(data);
        } catch (err: any) {
          console.error('Error fetching feeds:', err);
          setError(err.message || 'An unknown error occurred while fetching feeds.');
           toast({ // Add toast notification for error
                variant: "destructive",
                title: "Error Fetching Feeds",
                description: err.message || 'Could not load feeds. Please try again later.',
           });
        } finally {
          setLoading(false);
        }
    }, []); // No dependencies, fetches all feeds

  useEffect(() => {
    fetchFeeds();
  }, [fetchFeeds]); // Use the memoized fetchFeeds


  const refreshFeed = async (feedId: number) => {
    if (refreshingFeedId) return; // Prevent multiple refreshes
    setRefreshingFeedId(feedId);
    setError(null); // Clear previous errors specific to refresh

    try {
      const response = await fetch(`/api/feeds/${feedId}/refresh`, {
        method: 'POST'
      });

       const responseData = await response.json(); // Try to get JSON response regardless of status

      if (!response.ok) {
        throw new Error(responseData.error || `Failed to refresh feed (status: ${response.status})`);
      }

      // Update the feed's last_fetched time in the UI optimistically/realistically
       setFeeds(prevFeeds =>
         prevFeeds.map(feed =>
           feed.id === feedId
             ? { ...feed, last_fetched: new Date().toISOString() } // Set to current time
             : feed
         )
       );
       toast({
            title: "Feed Refresh Initiated",
            description: responseData.message || `Feed refresh started for feed ID ${feedId}.`,
       });
    } catch (err: any) {
      console.error('Error refreshing feed:', err);
      setError(`Failed to refresh feed ID ${feedId}: ${err.message}`); // Show error specific to refresh
        toast({
            variant: "destructive",
            title: `Refresh Error (Feed ${feedId})`,
            description: err.message || "Could not refresh the feed.",
        });
    } finally {
      setRefreshingFeedId(null);
    }
  };

  // Get unique languages for tabs
   const languages = [...new Set(feeds.map(feed => feed.language || '??').filter(lang => lang !== '??'))];

  const filteredFeeds = activeTab === 'all'
    ? feeds
    : feeds.filter(feed => feed.language === activeTab);

   const renderFeedCard = (feed: Feed) => (
       <Card key={feed.id} className={`overflow-hidden flex flex-col ${!feed.active ? 'opacity-60' : ''}`}>
           <CardHeader className="pb-3">
             <CardTitle className="truncate text-lg">{feed.title}</CardTitle>
             <div className="flex flex-wrap gap-1 mt-1">
               {feed.category && <Badge variant="outline">{feed.category}</Badge>}
               {feed.language && <Badge variant="secondary">{feed.language.toUpperCase()}</Badge>}
                {!feed.active && <Badge variant="destructive">Inactive</Badge>}
             </div>
           </CardHeader>
           <CardContent className="flex-grow">
             <CardDescription className="line-clamp-2 mb-3 text-foreground/80">
               {feed.description || 'No description available'}
             </CardDescription>
             <p className="text-xs text-muted-foreground">
               Last fetched: {formatDate(feed.last_fetched)}
             </p>
           </CardContent>
           <CardFooter className="flex flex-wrap justify-between items-center gap-2 pt-3 bg-muted/50 px-4 py-3">
             <Button
                 variant="ghost"
                 size="sm"
                 onClick={() => refreshFeed(feed.id)}
                 disabled={refreshingFeedId === feed.id || !feed.active}
             >
               <RefreshCw className={`h-4 w-4 mr-1.5 ${refreshingFeedId === feed.id ? 'animate-spin' : ''}`} />
               {refreshingFeedId === feed.id ? 'Refreshing...' : 'Refresh'}
             </Button>
              {/* Link to the page showing articles for this specific feed */}
             <Link href={`/feeds/${feed.id}`} passHref>
               <Button size="sm" disabled={!feed.active}>
                 <Newspaper className="h-4 w-4 mr-1.5" />
                 View Articles
               </Button>
             </Link>
           </CardFooter>
       </Card>
   );

   const renderSkeletonCard = (index: number) => (
        <Card key={`skel-feed-${index}`} className="overflow-hidden flex flex-col">
            <CardHeader className="pb-3">
                <Skeleton className="h-6 w-3/4 mb-2" />
                <div className="flex gap-1 mt-1">
                    <Skeleton className="h-5 w-16" />
                    <Skeleton className="h-5 w-10" />
                </div>
            </CardHeader>
            <CardContent className="flex-grow">
                <Skeleton className="h-4 w-full mb-1" />
                <Skeleton className="h-4 w-5/6 mb-3" />
                <Skeleton className="h-3 w-32" />
            </CardContent>
            <CardFooter className="flex justify-between items-center gap-2 pt-3 bg-muted/50 px-4 py-3">
                 <Skeleton className="h-8 w-24" />
                 <Skeleton className="h-8 w-32" />
            </CardFooter>
        </Card>
    );

  return (
    <div className="container mx-auto py-6">
      <div className="flex flex-col sm:flex-row justify-between items-center mb-6 gap-4">
        <h1 className="text-3xl font-bold">RSS Feeds</h1>
         {/* Link to a potential "Add Feed" page */}
         <Link href="/feeds/add" passHref>
             <Button>
               <PlusCircle className="mr-2 h-4 w-4" />
               Add Feed
             </Button>
         </Link>
      </div>

       {error && (
           <Alert variant="destructive" className="mb-4">
             <AlertTriangle className="h-4 w-4" />
             <AlertTitle>Error</AlertTitle>
             <AlertDescription>{error}</AlertDescription>
           </Alert>
       )}


      <Tabs defaultValue="all" value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="mb-4 overflow-x-auto whitespace-nowrap justify-start sm:justify-center">
          <TabsTrigger value="all">All</TabsTrigger>
          {languages.map(lang => (
            <TabsTrigger key={lang} value={lang}>
              {lang.toUpperCase()}
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value={activeTab} className="mt-0">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {loading ? (
               Array.from({ length: 6 }).map((_, index) => renderSkeletonCard(index))
            ) : filteredFeeds.length === 0 ? (
              <Card className="sm:col-span-2 lg:col-span-3 xl:col-span-4 text-center py-12">
                   <CardContent>
                        <p className="text-muted-foreground">
                             {activeTab === 'all' && !error ? 'No feeds found. Click "Add Feed" to get started.' : `No feeds found for language "${activeTab}".`}
                        </p>
                   </CardContent>
              </Card>
            ) : (
              filteredFeeds.map(feed => renderFeedCard(feed))
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default FeedList;
