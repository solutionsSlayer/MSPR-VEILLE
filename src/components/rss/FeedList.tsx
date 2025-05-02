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
import { Rss, RefreshCw, Newspaper, Languages } from "lucide-react";
import Link from 'next/link';

interface Feed {
  id: number;
  title: string;
  url: string;
  description: string;
  language: string;
  category: string;
  last_fetched: string;
}

const formatDate = (dateString: string) => {
  if (!dateString) return 'Never';
  const date = new Date(dateString);
  return new Intl.DateTimeFormat('en-US', {
    dateStyle: 'medium',
    timeStyle: 'short'
  }).format(date);
};

const FeedList = () => {
  const [feeds, setFeeds] = useState<Feed[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('all');

  useEffect(() => {
    const fetchFeeds = async () => {
      try {
        const response = await fetch('/api/feeds');
        if (!response.ok) throw new Error('Failed to fetch feeds');
        const data = await response.json();
        setFeeds(data);
      } catch (error) {
        console.error('Error fetching feeds:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchFeeds();
  }, []);

  const refreshFeed = async (feedId: number) => {
    try {
      const response = await fetch(`/api/feeds/${feedId}/refresh`, {
        method: 'POST'
      });
      if (!response.ok) throw new Error('Failed to refresh feed');
      
      // Update the feed's last_fetched time in the UI
      setFeeds(prevFeeds => 
        prevFeeds.map(feed => 
          feed.id === feedId 
            ? { ...feed, last_fetched: new Date().toISOString() } 
            : feed
        )
      );
    } catch (error) {
      console.error('Error refreshing feed:', error);
    }
  };

  const filteredFeeds = activeTab === 'all' 
    ? feeds 
    : feeds.filter(feed => feed.language === activeTab);
  
  const categories = [...new Set(feeds.map(feed => feed.category))];
  const languages = [...new Set(feeds.map(feed => feed.language))];

  return (
    <div className="container mx-auto py-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">RSS Feeds</h1>
        <Button>
          <Rss className="mr-2 h-4 w-4" />
          Add Feed
        </Button>
      </div>

      <Tabs defaultValue="all" onValueChange={setActiveTab}>
        <TabsList className="mb-4">
          <TabsTrigger value="all">All</TabsTrigger>
          {languages.map(lang => (
            <TabsTrigger key={lang} value={lang}>
              {lang.toUpperCase()}
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value={activeTab} className="mt-0">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {loading ? (
              <p>Loading feeds...</p>
            ) : filteredFeeds.length === 0 ? (
              <p>No feeds found.</p>
            ) : (
              filteredFeeds.map(feed => (
                <Card key={feed.id} className="overflow-hidden">
                  <CardHeader className="pb-3">
                    <CardTitle className="truncate">{feed.title}</CardTitle>
                    <div className="flex gap-2 mt-1">
                      <Badge variant="outline">{feed.category}</Badge>
                      <Badge variant="secondary">{feed.language.toUpperCase()}</Badge>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <CardDescription className="line-clamp-2 mb-3">
                      {feed.description || 'No description available'}
                    </CardDescription>
                    <p className="text-sm text-muted-foreground">
                      Last updated: {formatDate(feed.last_fetched)}
                    </p>
                  </CardContent>
                  <CardFooter className="flex justify-between pt-3">
                    <Button variant="ghost" size="sm" onClick={() => refreshFeed(feed.id)}>
                      <RefreshCw className="h-4 w-4 mr-2" />
                      Refresh
                    </Button>
                    <Link href={`/feeds/${feed.id}`} passHref>
                      <Button size="sm">
                        <Newspaper className="h-4 w-4 mr-2" />
                        View Articles
                      </Button>
                    </Link>
                  </CardFooter>
                </Card>
              ))
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default FeedList;
