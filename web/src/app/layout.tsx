import type { Metadata } from 'next';
import { Inter, JetBrains_Mono } from 'next/font/google';
import { Toaster } from 'react-hot-toast';
import './globals.css';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });
const jetbrains = JetBrains_Mono({ subsets: ['latin'], variable: '--font-jetbrains' });

export const metadata: Metadata = {
  title: {
    default: 'Strat-Clone Engine',
    template: '%s | Strat-Clone Engine',
  },
  description: 'Train, test, and deploy transparent trading strategies with confidence.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className={`${inter.variable} ${jetbrains.variable} font-sans`}>
        {children}
        <Toaster
          position="top-right"
          toastOptions={{
            style: {
              background: '#18181b',
              color: '#fafafa',
              border: '1px solid #27272a',
            },
            success: { iconTheme: { primary: '#10b981', secondary: '#fafafa' } },
            error: { iconTheme: { primary: '#ef4444', secondary: '#fafafa' } },
          }}
        />
      </body>
    </html>
  );
}
