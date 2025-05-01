import type {Metadata} from 'next';
import { Inter } from 'next/font/google'; // Using Inter instead of Geist for broader compatibility
import './globals.css';
import { Toaster } from "@/components/ui/toaster"; // Import Toaster

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' }); // Setup Inter font

export const metadata: Metadata = {
  title: 'QuantumWatch', // Updated title
  description: 'Quantum Cryptography News Aggregator and Summarizer', // Updated description
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${inter.variable} font-sans antialiased`}> {/* Use Inter font class */}
        {children}
        <Toaster /> {/* Add Toaster component here */}
      </body>
    </html>
  );
}
