import React from 'react';
import { Atom } from 'lucide-react'; // Using Atom icon for Quantum theme

export default function AppHeader() {
  return (
    <header className="bg-primary text-primary-foreground shadow-md sticky top-0 z-50">
      <div className="container mx-auto px-4 py-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
           <Atom size={32} />
          <h1 className="text-2xl font-bold">QuantumWatch</h1>
        </div>
        {/* Navigation links can be added here if needed */}
      </div>
    </header>
  );
}