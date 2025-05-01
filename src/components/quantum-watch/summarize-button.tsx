import React from 'react';
import { Button } from '@/components/ui/button';
import { Sparkles, Loader2 } from 'lucide-react';

interface SummarizeButtonProps {
  onClick: () => void;
  isLoading: boolean;
  disabled?: boolean;
}

export default function SummarizeButton({ onClick, isLoading, disabled = false }: SummarizeButtonProps) {
  return (
    <Button onClick={onClick} disabled={isLoading || disabled} variant="default" size="lg">
      {isLoading ? (
        <>
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          Summarizing...
        </>
      ) : (
        <>
          <Sparkles className="mr-2 h-4 w-4" />
          Summarize News
        </>
      )}
    </Button>
  );
}