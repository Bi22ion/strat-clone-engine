'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Brain, Database, Link2, Bot, Activity, ArrowRight, TrendingUp, TrendingDown, Target, Crosshair } from 'lucide-react';
import { dashboard, DashboardSummary, LiveStock, ProjectedTrade } from '@/lib/api';
import GiftWebsitePreview from './GiftWebsitePreview';

export default function DashboardPage() {
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [liveStocks, setLiveStocks] = useState<LiveStock[]>([]);
  const [projectedTrades, setProjectedTrades] = useState<ProjectedTrade[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    dashboard.summary().then(setSummary).catch(() => {}).finally(() => setLoading(false));
    dashboard.liveStocks().then((data) => {
      setLiveStocks(data.liveStocks || []);
      setProjectedTrades(data.projectedTrades || []);
    }).catch(() => {});
    const interval = setInterval(() => {
      dashboard.summary().then(setSummary).catch(() => {});
      dashboard.liveStocks().then((data) => {
        setLiveStocks(data.liveStocks || []);
        setProjectedTrades(data.projectedTrades || []);
      }).catch(() => {});
    }, 10000);
    return () => clearInterval(interval);
  }, []);

  const stats = [
    { label: 'Active Models', value: summary?.activeModels ?? 0, icon: Brain, color: 'text-accent-cyan', link: '/dashboard/models' },
    { label: 'Datasets', value: summary?.totalDatasets ?? 0, icon: Database, color: 'text-accent-purple', link: '/dashboard/datasets' },
    { label: 'Active Bots', value: summary?.activeBots ?? 0, icon: Bot, color: 'text-accent-green', link: '/dashboard/bots' },
    { label: 'Executions', value: summary?.executionsToday ?? 0, icon: Activity, color: 'text-amber-400', link: '/dashboard/bots' },
  ];

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold mb-1">Trading Dashboard</h1>
        <p className="text-zinc-400">Your AI-powered trading command center</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {stats.map((stat) => (
          <Link key={stat.label} href={stat.link}>
            <div className="card-hover">
              <div className="flex items-center justify-between mb-2">
                <stat.icon className={`w-5 h-5 ${stat.color}`} />
                <ArrowRight className="w-4 h-4 text-zinc-600" />
              </div>
              <p className="text-3xl font-bold mono-data">{loading ? '—' : stat.value}</p>
              <p className="text-xs text-zinc-500 mt-1">{stat.label}</p>
            </div>
          </Link>
        ))}
      </div>

      {/* Broker Status Bar */}
      {summary && (
        <div className="card mb-8 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link2 className="w-5 h-5 text-accent-cyan" />
            <div>
              <p className="text-sm font-medium">Broker Status</p>
              <p className="text-xs text-zinc-500">Alpaca · {summary.broker.is_paper_trading ? 'Paper Trading' : 'Live'}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className={`w-2 h-2 rounded-full ${summary.broker.connection_status === 'connected' ? 'bg-emerald-400 animate-pulse' : 'bg-red-400'}`} />
            <span className={`text-sm font-medium capitalize ${summary.broker.connection_status === 'connected' ? 'text-emerald-400' : 'text-red-400'}`}>
              {summary.broker.connection_status}
            </span>
          </div>
        </div>
      )}

      <div className="grid lg:grid-cols-3 gap-8">
        {/* Live Stocks Widget */}
        <div className="lg:col-span-2 card">
          <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <Activity className="w-5 h-5 text-accent-cyan" />
            Live Stocks
          </h3>
          {liveStocks.length === 0 ? (
            <p className="text-zinc-500 text-center py-8 text-sm">Loading live tickers...</p>
          ) : (
            <div className="grid sm:grid-cols-2 gap-3">
              {liveStocks.map((stock) => (
                <div key={stock.symbol} className="bg-zinc-900 rounded-lg p-4 border border-border hover:border-zinc-700 transition-colors">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-bold text-sm">{stock.symbol}</span>
                    <span className={`text-xs flex items-center gap-1 ${stock.isUp ? 'text-emerald-400' : 'text-red-400'}`}>
                      {stock.isUp ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                      {stock.isUp ? '+' : ''}{stock.changePct}%
                    </span>
                  </div>
                  <p className="text-xl font-bold mono-data">${stock.price.toLocaleString()}</p>
                  {stock.tradeCount > 0 && (
                    <div className="flex items-center gap-3 mt-2 text-xs text-zinc-500">
                      <span>{stock.tradeCount} trades</span>
                      <span className={stock.totalPnl >= 0 ? 'text-emerald-400' : 'text-red-400'}>
                        P&L: ${stock.totalPnl.toFixed(2)}
                      </span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Projected Trades */}
          {projectedTrades.length > 0 && (
            <div className="mt-6">
              <h4 className="text-sm font-medium text-zinc-400 mb-3 flex items-center gap-2">
                <Crosshair className="w-4 h-4 text-amber-400" />
                Projected Trades / Paper Signals
              </h4>
              <div className="space-y-2">
                {projectedTrades.map((trade, i) => (
                  <div key={i} className="bg-zinc-900 rounded-lg p-3 border border-border">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className={`text-xs font-bold px-2 py-0.5 rounded ${trade.signal === 'STRONG_BUY' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-blue-500/20 text-blue-400'}`}>
                          {trade.signal}
                        </span>
                        <span className="font-medium text-sm">{trade.symbol}</span>
                      </div>
                      <span className="text-xs text-zinc-500">{trade.model}</span>
                    </div>
                    <div className="grid grid-cols-4 gap-2 text-xs">
                      <div>
                        <p className="text-zinc-500">Entry</p>
                        <p className="mono-data text-zinc-300">${trade.entryPrice.toFixed(2)}</p>
                      </div>
                      <div>
                        <p className="text-zinc-500">Target</p>
                        <p className="mono-data text-emerald-400">${trade.takeProfit.toFixed(2)}</p>
                      </div>
                      <div>
                        <p className="text-zinc-500">Stop</p>
                        <p className="mono-data text-red-400">${trade.stopLoss.toFixed(2)}</p>
                      </div>
                      <div>
                        <p className="text-zinc-500">Confidence</p>
                        <p className="mono-data text-amber-400">{trade.confidence}%</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Gift Website Preview */}
        <div>
          <GiftWebsitePreview />
        </div>
      </div>
    </div>
  );
}
