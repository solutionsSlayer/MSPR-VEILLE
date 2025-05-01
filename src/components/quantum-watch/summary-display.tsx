import React from 'react';
import type { SummarizeQuantumNewsOutput } from '@/ai/flows/summarize-quantum-news';
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { FileText, Mic } from 'lucide-react';

interface SummaryDisplayProps {
  summaryData: SummarizeQuantumNewsOutput | null;
  isLoading: boolean;
}

export default function SummaryDisplay({ summaryData, isLoading }: SummaryDisplayProps) {
  return (
    <Card className="bg-card shadow-sm min-h-[300px] flex flex-col">
      <CardHeader>
        <CardTitle className="text-lg font-semibold flex items-center gap-2">
            <FileText size={20} /> Summary
        </CardTitle>
      </CardHeader>
      <CardContent className="flex-grow">
        {isLoading ? (
          <SummarySkeleton />
        ) : summaryData?.summary ? (
          <ScrollArea className="h-[200px] pr-4">
            <p className="text-sm text-foreground whitespace-pre-wrap">{summaryData.summary}</p>
          </ScrollArea>
        ) : (
          <p className="text-sm text-muted-foreground">Click "Summarize News" to generate a summary.</p>
        )}
      </CardContent>
      {summaryData?.podcastUrl && !isLoading && (
        <CardFooter>
          <Button variant="outline" size="sm" asChild>
            <a href={summaryData.podcastUrl} target="_blank" rel="noopener noreferrer">
              <Mic size={16} className="mr-2"/>
              Listen to Podcast
            </a>
          </Button>
        </CardFooter>
      )}
    </Card>
  );
}

// Skeleton Loader for Summary
const SummarySkeleton = () => (
  <div className="space-y-3">
    <Skeleton className="h-4 w-full" />
    <Skeleton className="h-4 w-full" />
    <Skeleton className="h-4 w-5/6" />
    <Skeleton className="h-4 w-3/4" />
     <Skeleton className="h-4 w-4/6" />
  </div>
);