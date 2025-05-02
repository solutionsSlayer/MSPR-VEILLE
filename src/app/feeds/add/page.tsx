"use client";

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import AppHeader from '@/components/AppHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea'; // Assuming you have Textarea
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"; // Assuming Select
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { LogOut, ArrowLeft, Terminal, Save } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { toast } from '@/hooks/use-toast';

export default function AddFeedPage() {
  const router = useRouter();
  const { logout } = useAuth();
  const [title, setTitle] = useState('');
  const [url, setUrl] = useState('');
  const [description, setDescription] = useState('');
  const [language, setLanguage] = useState('');
  const [category, setCategory] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    try {
      const response = await fetch('/api/feeds', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ title, url, description, language, category }),
      });

      const responseData = await response.json();

      if (!response.ok) {
        throw new Error(responseData.error || `Failed to add feed (status: ${response.status})`);
      }

      toast({
        title: "Feed Added",
        description: `Successfully added feed: ${title}`,
      });
      router.push('/'); // Redirect to the main feed list after successful addition

    } catch (err: any) {
      console.error("Error adding feed:", err);
      setError(err.message || 'An unknown error occurred.');
       toast({
             variant: "destructive",
             title: "Error Adding Feed",
             description: err.message || "Could not add the feed.",
        });
    } finally {
      setIsSubmitting(false);
    }
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
          Back to Feeds
        </Button>

        <Card className="max-w-2xl mx-auto">
          <CardHeader>
            <CardTitle>Add New RSS Feed</CardTitle>
            <CardDescription>Enter the details for the new RSS feed you want to monitor.</CardDescription>
          </CardHeader>
          <form onSubmit={handleSubmit}>
            <CardContent className="space-y-4">
              {error && (
                <Alert variant="destructive">
                  <Terminal className="h-4 w-4" />
                  <AlertTitle>Error</AlertTitle>
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}
              <div className="space-y-2">
                <Label htmlFor="url">Feed URL *</Label>
                <Input
                  id="url"
                  type="url"
                  placeholder="https://example.com/feed.xml"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  required
                  disabled={isSubmitting}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="title">Title *</Label>
                <Input
                  id="title"
                  type="text"
                  placeholder="My Awesome Feed"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  required
                  disabled={isSubmitting}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  placeholder="A brief description of the feed content."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  disabled={isSubmitting}
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                 <div className="space-y-2">
                   <Label htmlFor="language">Language</Label>
                    <Select value={language} onValueChange={setLanguage} disabled={isSubmitting}>
                       <SelectTrigger id="language">
                         <SelectValue placeholder="Select language" />
                       </SelectTrigger>
                       <SelectContent>
                         <SelectItem value="en">English (en)</SelectItem>
                         <SelectItem value="fr">French (fr)</SelectItem>
                         <SelectItem value="de">German (de)</SelectItem>
                         <SelectItem value="es">Spanish (es)</SelectItem>
                         {/* Add more languages as needed */}
                       </SelectContent>
                    </Select>
                 </div>
                 <div className="space-y-2">
                   <Label htmlFor="category">Category</Label>
                   <Input
                     id="category"
                     type="text"
                     placeholder="e.g., Quantum Computing, Technology"
                     value={category}
                     onChange={(e) => setCategory(e.target.value)}
                     disabled={isSubmitting}
                   />
                 </div>
              </div>
            </CardContent>
            <CardFooter>
              <Button type="submit" disabled={isSubmitting}>
                 {isSubmitting ? (
                    <>
                      <Skeleton className="h-4 w-4 mr-2 animate-spin rounded-full" /> Saving...
                    </>
                 ) : (
                    <>
                      <Save className="h-4 w-4 mr-2" /> Save Feed
                    </>
                 )}
              </Button>
            </CardFooter>
          </form>
        </Card>
      </main>
      <footer className="bg-primary text-primary-foreground py-4 mt-auto">
        <div className="container mx-auto text-center text-sm">
          QuantumWatch &copy; {new Date().getFullYear()}
        </div>
      </footer>
    </div>
  );
}
