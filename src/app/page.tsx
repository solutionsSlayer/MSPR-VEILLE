"use client";

import React, { useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import FeedList from '@/components/rss/FeedList'; // Assuming FeedList is the main component to show
import { Button } from '@/components/ui/button';
import { LogOut } from 'lucide-react';
import AppHeader from '@/components/AppHeader'; // Use a shared AppHeader

export default function Home() {
  const { isAuthenticated, isLoading, logout } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push('/login');
    }
  }, [isAuthenticated, isLoading, router]);

  if (isLoading || !isAuthenticated) {
    // You can show a loading spinner or skeleton here
    return (
        <div className="flex items-center justify-center min-h-screen bg-secondary">
            Loading...
        </div>
    );
  }

  // If authenticated, show the main content (e.g., FeedList)
  return (
    <div className="flex flex-col min-h-screen bg-secondary">
       <AppHeader>
            {/* Add logout button to header */}
            <Button variant="ghost" size="sm" onClick={logout}>
                <LogOut className="mr-2 h-4 w-4" /> Logout
            </Button>
       </AppHeader>
      <main className="flex-grow container mx-auto px-4 py-8">
        <FeedList />
      </main>
       <footer className="bg-primary text-primary-foreground py-4 mt-auto">
        <div className="container mx-auto text-center text-sm">
          QuantumWatch &copy; {new Date().getFullYear()}
        </div>
      </footer>
    </div>
  );
}
