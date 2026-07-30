'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Zap, LayoutDashboard, Database, Brain, Link2, Bot, LogOut,
} from 'lucide-react';
import clsx from 'clsx';
import { useAuthGuard, logout, getUser } from '@/lib/auth';

const navItems = [
  { href: '/dashboard', label: 'Overview', icon: LayoutDashboard },
  { href: '/dashboard/datasets', label: 'Datasets', icon: Database },
  { href: '/dashboard/models', label: 'Models', icon: Brain },
  { href: '/dashboard/broker', label: 'Broker', icon: Link2 },
  { href: '/dashboard/bots', label: 'Bots', icon: Bot },
];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  useAuthGuard();
  const pathname = usePathname();
  
  const [mounted, setMounted] = useState(false);
  const [user, setUser] = useState<{ full_name?: string; email?: string } | null>(null);

  useEffect(() => {
    setMounted(true);
    setUser(getUser());
  }, []);

  return (
    <div className="min-h-screen flex bg-background">
      <aside className="w-64 border-r border-border bg-surface flex flex-col shrink-0">
        <div className="p-6 border-b border-border">
          <Link href="/dashboard" className="flex items-center gap-2">
            <Zap className="w-6 h-6 text-accent-green" />
            <span className="font-bold text-lg">Strat-Clone</span>
          </Link>
        </div>

        <nav className="flex-1 p-4 space-y-1">
          {navItems.map((item) => {
            const active = pathname === item.href || (item.href !== '/dashboard' && pathname.startsWith(item.href));
            return (
              <Link
                key={item.href}
                href={item.href}
                className={clsx(
                  'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200',
                  active
                    ? 'bg-accent-cyan/10 text-accent-cyan border border-accent-cyan/20'
                    : 'text-zinc-400 hover:text-white hover:bg-surface-hover'
                )}
              >
                <item.icon className="w-5 h-5" />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="p-4 border-t border-border">
          <div className="px-3 py-2 mb-2">
            {mounted ? (
              <>
                <p className="text-sm font-medium truncate">{user?.full_name || user?.email}</p>
                <p className="text-xs text-zinc-500 truncate">{user?.email}</p>
              </>
            ) : (
              <div className="h-9 animate-pulse bg-zinc-800 rounded" />
            )}
          </div>
          <button onClick={logout} className="flex items-center gap-2 w-full px-3 py-2 text-sm text-zinc-400 hover:text-red-400 rounded-lg hover:bg-red-500/5 transition-all">
            <LogOut className="w-4 h-4" />
            Sign Out
          </button>
        </div>
      </aside>

      <main className="flex-1 overflow-auto">
        <div className="p-8">{children}</div>
      </main>
    </div>
  );
}