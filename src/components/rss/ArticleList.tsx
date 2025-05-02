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
import { Bookmark, BookmarkCheck, Headphones, FileText, Calendar, User } from "lucide-react";
import Link from 'next/link';

interface Article {
  id: number;
  feed_id: number;
  title: string;
  link: string;
  description: string;
  author: string;
  published_date: string;
  is_read: boolean;
  is_bookmarked: boolean;
  has_summary: boolean;
  has_podcast: boolean;
}

const formatDate = (dateString: string) => {
  if (!dateString) return 'Unknown date';
  const date = new Date(dateString);
  return new Intl.DateTimeFormat('en-US', {
    dateStyle: 'medium'
  }).format(date);
};

interface ArticleListProps {
  feedId?: number;
}

const ArticleList: React.FC<ArticleListProps> = ({ feedId }) => {
  const [articles, setArticles] = useState<Article[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('all');

  useEffect(() => {
    const fetchArticles = async () => {
      try {
        const url = feedId 
          ? `/api/feeds/${feedId}/articles` 
          : '/api/articles';
        
        const response = await fetch(url);
        if (!response.ok) throw new Error('Failed to fetch articles');
        const data = await response.json();
        setArticles(data);
      } catch (error) {
        console.error('Error fetching articles:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchArticles();
  }, [feedId]);

  const toggleBookmark = async (articleId: number) => {
    try {
      const article = articles.find(a => a.id === articleId);
      if (!article) return;

      const response = await fetch(`/api/articles/${articleId}/bookmark`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ 
          is_bookmarked: !article.is_bookmarked 
        })
      });
      
      if (!response.ok) throw new Error('Failed to toggle bookmark');
      
      // Update the article's bookmark status in the UI
      setArticles(prevArticles => 
        prevArticles.map(article => 
          article.id === articleId 
            ? { ...article, is_bookmarked: !article.is_bookmarked } 
            : article
        )
      );
    } catch (error) {
      console.error('Error toggling bookmark:', error);
    }
  };

  const markAsRead = async (articleId: number) => {
    try {
      const response = await fetch(`/api/articles/${articleId}/read`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ 
          is_read: true 
        })
      });
      
      if (!response.ok) throw new Error('Failed to mark as read');
      
      // Update the article's read status in the UI
      setArticles(prevArticles => 
        prevArticles.map(article => 
          article.id === articleId 
            ? { ...article, is_read: true } 
            : article
        )
      );
    } catch (error) {
      console.error('Error marking as read:', error);
    }
  };

  let filteredArticles = articles;
  
  switch (activeTab) {
    case 'unread':
      filteredArticles = articles.filter(article => !article.is_read);
      break;
    case 'bookmarked':
      filteredArticles = articles.filter(article => article.is_bookmarked);
      break;
    case 'with-summary':
      filteredArticles = articles.filter(article => article.has_summary);
      break;
    case 'with-podcast':
      filteredArticles = articles.filter(article => article.has_podcast);
      break;
    default:
      filteredArticles = articles;
  }

  return (
    <div className="container mx-auto py-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">Articles</h1>
      </div>

      <Tabs defaultValue="all" onValueChange={setActiveTab}>
        <TabsList className="mb-4">
          <TabsTrigger value="all">All</TabsTrigger>
          <TabsTrigger value="unread">Unread</TabsTrigger>
          <TabsTrigger value="bookmarked">Bookmarked</TabsTrigger>
          <TabsTrigger value="with-summary">With Summary</TabsTrigger>
          <TabsTrigger value="with-podcast">With Podcast</TabsTrigger>
        </TabsList>

        <TabsContent value={activeTab} className="mt-0">
          <div className="space-y-4">
            {loading ? (
              <p>Loading articles...</p>
            ) : filteredArticles.length === 0 ? (
              <p>No articles found.</p>
            ) : (
              filteredArticles.map(article => (
                <Card 
                  key={article.id} 
                  className={`overflow-hidden ${article.is_read ? 'opacity-80' : ''}`}
                >
                  <CardHeader className="pb-3">
                    <CardTitle className="truncate">
                      <a 
                        href={article.link} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        onClick={() => markAsRead(article.id)}
                        className="hover:underline"
                      >
                        {article.title}
                      </a>
                    </CardTitle>
                    <div className="flex gap-2 mt-1 items-center text-sm text-muted-foreground">
                      <Calendar className="h-4 w-4" />
                      <span>{formatDate(article.published_date)}</span>
                      
                      {article.author && (
                        <>
                          <User className="h-4 w-4 ml-3" />
                          <span>{article.author}</span>
                        </>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent>
                    <CardDescription 
                      className="line-clamp-3 mb-3"
                      dangerouslySetInnerHTML={{ __html: article.description }}
                    />
                  </CardContent>
                  <CardFooter className="flex justify-between pt-3">
                    <div className="flex space-x-2">
                      {article.has_summary && (
                        <Link href={`/articles/${article.id}/summary`} passHref>
                          <Button variant="outline" size="sm">
                            <FileText className="h-4 w-4 mr-2" />
                            Summary
                          </Button>
                        </Link>
                      )}
                      
                      {article.has_podcast && (
                        <Link href={`/articles/${article.id}/podcast`} passHref>
                          <Button variant="outline" size="sm">
                            <Headphones className="h-4 w-4 mr-2" />
                            Podcast
                          </Button>
                        </Link>
                      )}
                    </div>
                    
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      onClick={() => toggleBookmark(article.id)}
                    >
                      {article.is_bookmarked ? (
                        <BookmarkCheck className="h-4 w-4 mr-2" />
                      ) : (
                        <Bookmark className="h-4 w-4 mr-2" />
                      )}
                      {article.is_bookmarked ? 'Bookmarked' : 'Bookmark'}
                    </Button>
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

export default ArticleList;
