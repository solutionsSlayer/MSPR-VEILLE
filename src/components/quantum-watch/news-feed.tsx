import React from 'react';
import type { RssItem } from '@/services/rss-feed';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ExternalLink, Calendar } from 'lucide-react';

interface NewsFeedProps {
  items: RssItem[];
}

export default function NewsFeed({ items }: NewsFeedProps) {
  if (!items || items.length === 0) {
    return <p className="text-muted-foreground">No news items available.</p>;
  }

  return (
    <div className="space-y-4">
      {items.map((item, index) => (
        <Card key={index} className="bg-card shadow-sm hover:shadow-md transition-shadow duration-200">
          <CardHeader>
            <CardTitle className="text-lg font-semibold">{item.title}</CardTitle>
            {item.pubDate && (
              <CardDescription className="text-xs text-muted-foreground flex items-center gap-1 pt-1">
                <Calendar size={14} />
                {new Date(item.pubDate).toLocaleDateString()}
              </CardDescription>
            )}
          </CardHeader>
          {item.description && (
            <CardContent>
              <p className="text-sm text-foreground line-clamp-3">{item.description}</p>
            </CardContent>
          )}
          <CardFooter>
            <Button variant="link" size="sm" asChild className="p-0 h-auto text-accent hover:text-accent-foreground">
              <a href={item.link} target="_blank" rel="noopener noreferrer">
                Read More <ExternalLink size={14} className="ml-1" />
              </a>
            </Button>
          </CardFooter>
        </Card>
      ))}
    </div>
  );
}