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
import { Bookmark, BookmarkCheck, Headphones, FileText, Calendar, User, ExternalLink, RefreshCw, AlertTriangle } from "lucide-react";
import Link from 'next/link';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { toast } from '@/hooks/use-toast'; // Import toast


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
  try {
      const date = new Date(dateString);
      // Check if date is valid
      if (isNaN(date.getTime())) return 'Invalid date';
      return new Intl.DateTimeFormat('en-US', {
        year: 'numeric', month: 'short', day: 'numeric'
      }).format(date);
  } catch (e) {
      console.error("Error formatting date:", dateString, e);
      return 'Invalid date';
  }
};

interface ArticleListProps {
  feedId?: number;
}

const ArticleList: React.FC<ArticleListProps> = ({ feedId }) => {
  const [articles, setArticles] = useState<Article[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('all');

   const fetchArticles = useCallback(async () => {
      setLoading(true);
      setError(null);
      try {
        const url = feedId
          ? `/api/feeds/${feedId}/articles`
          : '/api/articles';

        const response = await fetch(url);
        if (!response.ok) {
           const errorData = await response.json().catch(() => ({ error: 'Failed to fetch articles' }));
           throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
        }
        const data = await response.json();
        setArticles(data);
      } catch (err: any) {
        console.error('Error fetching articles:', err);
        setError(err.message || 'An unknown error occurred while fetching articles.');
         toast({ // Add toast notification for error
              variant: "destructive",
              title: "Error Fetching Articles",
              description: err.message || 'Could not load articles. Please try again later.',
         });
      } finally {
        setLoading(false);
      }
    }, [feedId]); // Only depends on feedId


  useEffect(() => {
    fetchArticles();
  }, [fetchArticles]); // Use the memoized fetchArticles

  const updateArticleState = (articleId: number, updates: Partial<Article>) => {
     setArticles(prevArticles =>
       prevArticles.map(article =>
         article.id === articleId ? { ...article, ...updates } : article
       )
     );
  };

  const toggleBookmark = async (articleId: number) => {
    const article = articles.find(a => a.id === articleId);
    if (!article) return;

    const originalState = article.is_bookmarked;
    // Optimistically update UI
    updateArticleState(articleId, { is_bookmarked: !originalState });

    try {
      const response = await fetch(`/api/articles/${articleId}/bookmark`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_bookmarked: !originalState })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to toggle bookmark');
      }
       toast({ title: `Article ${!originalState ? 'bookmarked' : 'unbookmarked'}.` });
    } catch (err: any) {
      console.error('Error toggling bookmark:', err);
      // Revert UI on error
      updateArticleState(articleId, { is_bookmarked: originalState });
       toast({
             variant: "destructive",
             title: "Bookmark Error",
             description: err.message || "Could not update bookmark.",
       });
    }
  };

  const markAsRead = async (articleId: number) => {
     const article = articles.find(a => a.id === articleId);
     // Mark as read only if not already read
     if (!article || article.is_read) return;

     updateArticleState(articleId, { is_read: true }); // Optimistic update

    try {
      const response = await fetch(`/api/articles/${articleId}/read`, {
        method: 'POST',
         headers: { 'Content-Type': 'application/json' },
         body: JSON.stringify({ is_read: true })
      });
       if (!response.ok) {
           const errorData = await response.json().catch(() => ({}));
           throw new Error(errorData.error || 'Failed to mark as read');
       }
       // No toast needed for marking as read typically
    } catch (err: any) {
      console.error('Error marking as read:', err);
       updateArticleState(articleId, { is_read: false }); // Revert on error
        toast({
             variant: "destructive",
             title: "Read Status Error",
             description: err.message || "Could not mark article as read.",
        });
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
    default: // 'all'
      filteredArticles = articles;
  }

  const renderArticleCard = (article: Article) => (
     <Card
       key={article.id}
       className={`overflow-hidden transition-opacity duration-300 ${article.is_read ? 'opacity-70 hover:opacity-100' : 'opacity-100'}`}
     >
       <CardHeader className="pb-3">
         {/* Link the title to the full article detail page */}
         <Link href={`/articles/${article.id}`} passHref>
             <CardTitle className="truncate text-lg hover:text-primary cursor-pointer">
                  {article.title || 'Untitled Article'}
             </CardTitle>
         </Link>
         <div className="flex flex-wrap gap-x-3 gap-y-1 mt-1 items-center text-sm text-muted-foreground">
           <span className="flex items-center gap-1">
              <Calendar className="h-3.5 w-3.5" />
              <span>{formatDate(article.published_date)}</span>
           </span>
           {article.author && (
             <span className="flex items-center gap-1">
               <User className="h-3.5 w-3.5" />
               <span className="truncate max-w-[150px]">{article.author}</span>
             </span>
           )}
            {/* Link to original article */}
             <a
                href={article.link}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => markAsRead(article.id)} // Mark as read when clicking original link
                className="flex items-center gap-1 text-accent hover:underline"
             >
                 <ExternalLink className="h-3.5 w-3.5" />
                 <span>Source</span>
             </a>
         </div>
       </CardHeader>
       {article.description && (
            <CardContent className="pt-0 pb-4">
                 {/* Use dangerouslySetInnerHTML cautiously or sanitize */}
                 <CardDescription
                   className="line-clamp-3 text-foreground/80"
                   dangerouslySetInnerHTML={{ __html: article.description }}
                 />
            </CardContent>
       )}
       <CardFooter className="flex flex-wrap justify-between items-center gap-2 pt-3 bg-muted/50 px-4 py-3">
         <div className="flex flex-wrap gap-2">
           {/* Link to dedicated summary page */}
           <Link href={`/articles/${article.id}/summary`} passHref>
             <Button variant={article.has_summary ? "outline" : "secondary"} size="sm" disabled={!article.has_summary}>
               <FileText className="h-4 w-4 mr-1.5" />
               Summary
             </Button>
           </Link>
           {/* Link to dedicated podcast page */}
           <Link href={`/articles/${article.id}/podcast`} passHref>
             <Button variant={article.has_podcast ? "outline" : "secondary"} size="sm" disabled={!article.has_podcast}>
               <Headphones className="h-4 w-4 mr-1.5" />
               Podcast
             </Button>
           </Link>
         </div>
         <Button
           variant="ghost"
           size="sm"
           onClick={() => toggleBookmark(article.id)}
           aria-pressed={article.is_bookmarked}
           className="text-muted-foreground hover:text-primary"
         >
           {article.is_bookmarked ? (
             <BookmarkCheck className="h-4 w-4 mr-1.5 text-primary" />
           ) : (
             <Bookmark className="h-4 w-4 mr-1.5" />
           )}
           {article.is_bookmarked ? 'Bookmarked' : 'Bookmark'}
         </Button>
       </CardFooter>
     </Card>
   );

  const renderSkeletonCard = (index: number) => (
       <Card key={`skel-${index}`} className="overflow-hidden">
            <CardHeader className="pb-3">
                <Skeleton className="h-5 w-3/4 mb-2" />
                <div className="flex gap-3 mt-1">
                    <Skeleton className="h-4 w-24" />
                    <Skeleton className="h-4 w-20" />
                </div>
            </CardHeader>
             <CardContent className="pt-0 pb-4 space-y-2">
                 <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-5/6" />
             </CardContent>
            <CardFooter className="flex justify-between items-center gap-2 pt-3 bg-muted/50 px-4 py-3">
                <div className="flex gap-2">
                    <Skeleton className="h-8 w-24" />
                    <Skeleton className="h-8 w-24" />
                </div>
                 <Skeleton className="h-8 w-28" />
            </CardFooter>
       </Card>
   );

  return (
    <div className="container mx-auto py-6">
      <div className="flex flex-col sm:flex-row justify-between items-center mb-6 gap-4">
        <h1 className="text-3xl font-bold">Articles</h1>
         {/* Add refresh button */}
          <Button variant="outline" onClick={fetchArticles} disabled={loading}>
             <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
             {loading ? 'Refreshing...' : 'Refresh Articles'}
          </Button>
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
          <TabsTrigger value="unread">Unread</TabsTrigger>
          <TabsTrigger value="bookmarked">Bookmarked</TabsTrigger>
          <TabsTrigger value="with-summary">With Summary</TabsTrigger>
          <TabsTrigger value="with-podcast">With Podcast</TabsTrigger>
        </TabsList>

        <TabsContent value={activeTab} className="mt-0">
          <div className="space-y-4">
            {loading ? (
              Array.from({ length: 5 }).map((_, index) => renderSkeletonCard(index))
            ) : filteredArticles.length === 0 ? (
              <Card className="text-center py-12">
                   <CardContent>
                        <p className="text-muted-foreground">
                             {activeTab === 'all' && !error ? 'No articles found for this feed.' : `No articles match the filter "${activeTab}".`}
                        </p>
                   </CardContent>
              </Card>
            ) : (
              filteredArticles.map(article => renderArticleCard(article))
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default ArticleList;
