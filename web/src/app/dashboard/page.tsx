'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Brain, Database, Link2, Bot, Activity, ArrowRight } from 'lucide-react';
import { dashboard, DashboardSummary } from '@/lib/api';

function MetricCard({ label, value, icon: Icon, color }: {
  label: string;
  value: string | number;
  icon: React.ElementType;
  color: string;
}) {
  return (
    <div className="card-hover">
      <div className="flex items-center justify-between mb-4">
        <span className="text-sm text-zinc-400">{label}</span>
        <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${color}`}>
          <Icon className="w-5 h-5" />
        </div>
      </div>
      <p className="text-3xl font-bold mono-data">{value}</p>
    </div>
  );
}

function SkeletonCard() {
  return (
    <div className="card">
      <div className="skeleton h-4 w-24 mb-4" />
      <div className="skeleton h-8 w-16" />
    </div>
  );
}

const quickLinks = [
  { href: '/dashboard/datasets', label: 'Upload Dataset', icon: Database, desc: 'Import CSV trade history' },
  { href: '/dashboard/models', label: 'Train Model', icon: Brain, desc: 'Extract trading patterns' },
  { href: '/dashboard/broker', label: 'Connect Broker', icon: Link2, desc: 'Configure API keys' },
  { href: '/dashboard/bots', label: 'Manage Bots', icon: Bot, desc: 'Monitor live execution' },
];

export default function DashboardPage() {
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    dashboard.summary()
      .then(setSummary)
      .catch(() => setSummary(null))
      .finally(() => setLoading(false));
  }, []);

  const brokerStatus = summary?.broker?.connection_status || 'disconnected';
  const isConnected = brokerStatus === 'connected';

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold mb-1">Dashboard</h1>
        <p className="text-zinc-400">Overview of your trading automation platform</p>
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-10">
        {loading ? (
          <>
            <SkeletonCard /><SkeletonCard /><SkeletonCard /><SkeletonCard />
          </>
        ) : (
          <>
            <MetricCard label="Active Models" value={summary?.activeModels ?? 0} icon={Brain} color="bg-indigo-500/10 text-indigo-400" />
            <MetricCard label="Total Datasets" value={summary?.totalDatasets ?? 0} icon={Database} color="bg-cyan-500/10 text-cyan-400" />
            <MetricCard label="Active Bots" value={summary?.activeBots ?? 0} icon={Bot} color="bg-emerald-500/10 text-emerald-400" />
            <div className="card-hover">
              <div className="flex items-center justify-between mb-4">
                <span className="text-sm text-zinc-400">Broker Status</span>
                <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-amber-500/10 text-amber-400">
                  <Activity className="w-5 h-5" />
                </div>
              </div>
              <div className="flex items-center gap-2">
                {isConnected ? <span className="pulse-dot-green" /> : <span className="pulse-dot-red" />}
                <span className={`text-lg font-semibold capitalize ${isConnected ? 'text-emerald-400' : 'text-red-400'}`}>
                  {brokerStatus}
                </span>
              </div>
              {summary?.broker?.is_paper_trading && (
                <p className="text-xs text-zinc-500 mt-1">Paper trading mode</p>
              )}
            </div>
          </>
        )}
      </div>

      <h2 className="text-lg font-semibold mb-4">Quick Navigation</h2>
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {quickLinks.map((link) => (
          <Link key={link.href} href={link.href} className="card-hover group flex items-center justify-between">
            <div className="flex items-center gap-3">
              <link.icon className="w-5 h-5 text-zinc-400 group-hover:text-accent-cyan transition-colors" />
              <div>
                <p className="font-medium text-sm">{link.label}</p>
                <p className="text-xs text-zinc-500">{link.desc}</p>
              </div>
            </div>
            <ArrowRight className="w-4 h-4 text-zinc-600 group-hover:text-accent-cyan transition-colors" />
          </Link>
        ))}
      </div>
    </div>
  );
}
