"use client";

import React from 'react';
import ArticleList from '@/components/rss/ArticleList';
import AppHeader from '@/components/AppHeader'; // Use shared header
import { useAuth } from '@/context/AuthContext'; // Assuming AuthContext handles redirection
import { Button } from '@/components/ui/button';
import { LogOut } from 'lucide-react';


export default function ArticlesPage() {
   const { logout } = useAuth();
   // Auth check/redirect should be handled by layout or higher-level component / useEffect in Home

  return (
    <div className="flex flex-col min-h-screen bg-secondary">
       <AppHeader>
             <Button variant="ghost" size="sm" onClick={logout}>
                 <LogOut className="mr-2 h-4 w-4" /> Logout
             </Button>
       </AppHeader>
      <main className="flex-grow container mx-auto px-4 py-8">
        <ArticleList />
      </main>
       <footer className="bg-primary text-primary-foreground py-4 mt-auto">
        <div className="container mx-auto text-center text-sm">
          QuantumWatch &copy; {new Date().getFullYear()}
        </div>
      </footer>
    </div>
  );
}
