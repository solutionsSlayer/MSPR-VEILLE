import React from 'react';
import Link from 'next/link';
import { Atom, Rss, Newspaper } from 'lucide-react'; // Using Atom icon for Quantum theme

interface AppHeaderProps {
    children?: React.ReactNode; // To allow adding extra elements like logout button
}

export default function AppHeader({ children }: AppHeaderProps) {
  return (
    <header className="bg-primary text-primary-foreground shadow-md sticky top-0 z-50">
      <div className="container mx-auto px-4 py-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
           <Atom size={32} />
           <Link href="/" passHref>
                <h1 className="text-2xl font-bold cursor-pointer">QuantumWatch</h1>
           </Link>
        </div>
         <nav className="flex items-center gap-4">
            <Link href="/" passHref>
                <span className="flex items-center gap-1 hover:text-accent transition-colors cursor-pointer">
                    <Rss size={18} /> Feeds
                </span>
            </Link>
             <Link href="/articles" passHref>
                 <span className="flex items-center gap-1 hover:text-accent transition-colors cursor-pointer">
                    <Newspaper size={18} /> Articles
                 </span>
             </Link>
             {/* Placeholder for potential future nav items */}
         </nav>
        <div className="flex items-center gap-2">
            {children} {/* Render additional elements passed in */}
        </div>
      </div>
    </header>
  );
}
