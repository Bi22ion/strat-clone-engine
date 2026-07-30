'use client';

import { useCallback, useEffect, useState } from 'react';
import { Bot, Play, Square, AlertTriangle, Plus, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { bots, models, TradingBot, ExecutionLog, StrategyModel } from '@/lib/api';

function BotStatusBadge({ status }: { status: string }) {
  const config: Record<string, { class: string; dot: boolean }> = {
    active: { class: 'status-active', dot: true },
    inactive: { class: 'status-inactive', dot: false },
    stopped_by_risk: { class: 'status-error', dot: true },
    stopped_emergency: { class: 'status-error', dot: true },
  };
  const c = config[status] || config.inactive;
  return (
    <span className={c.class}>
      {c.dot && <span className={status === 'active' ? 'pulse-dot-green' : 'pulse-dot-red'} />}
      {status.replace(/_/g, ' ')}
    </span>
  );
}

export default function BotsPage() {
  const [botList, setBotList] = useState<TradingBot[]>([]);
  const [modelList, setModelList] = useState<StrategyModel[]>([]);
  const [logs, setLogs] = useState<ExecutionLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [killLoading, setKillLoading] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [newBot, setNewBot] = useState({ modelId: '', name: '', maxDailyLoss: 1000 });

  const load = useCallback(async () => {
    try {
      const [b, m, l] = await Promise.all([
        bots.list(),
        models.list(),
        bots.logs(50),
      ]);
      setBotList(b.bots);
      setModelList(m.models.filter((mod) => mod.status === 'ready'));
      setLogs(l.logs);
    } catch {
      toast.error('Failed to load bot data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    const interval = setInterval(load, 15000);
    return () => clearInterval(interval);
  }, [load]);

  async function handleCreate() {
    if (!newBot.modelId) {
      toast.error('Select a model');
      return;
    }
    try {
      await bots.create(newBot);
      toast.success('Bot created');
      setShowCreate(false);
      setNewBot({ modelId: '', name: '', maxDailyLoss: 1000 });
      load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to create bot');
    }
  }

  async function handleStart(id: string) {
    try {
      await bots.start(id);
      toast.success('Bot execution started');
      load();
    } catch {
      toast.error('Failed to start bot');
    }
  }

  async function handleStop(id: string) {
    try {
      await bots.stop(id);
      toast.success('Bot stopped');
      load();
    } catch {
      toast.error('Failed to stop bot');
    }
  }

  async function handleRiskChange(id: string, maxDailyLoss: number) {
    try {
      await bots.updateRisk(id, maxDailyLoss);
      load();
    } catch {
      toast.error('Failed to update risk settings');
    }
  }

  async function handleKillSwitch() {
    if (!confirm('EMERGENCY KILL SWITCH: This will stop ALL active bots and close all open positions. Continue?')) return;
    setKillLoading(true);
    try {
      const result = await bots.killSwitch();
      toast.success(`Emergency halt complete — ${result.botsStopped} bots stopped`);
      load();
    } catch {
      toast.error('Kill switch failed');
    } finally {
      setKillLoading(false);
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold mb-1">Trading Bots</h1>
          <p className="text-zinc-400">Monitor and control your automated trading bots</p>
        </div>
        <div className="flex gap-3">
          <button onClick={() => setShowCreate(!showCreate)} className="btn-primary flex items-center gap-2">
            <Plus className="w-4 h-4" /> New Bot
          </button>
          <button onClick={handleKillSwitch} className="btn-danger flex items-center gap-2" disabled={killLoading}>
            {killLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <AlertTriangle className="w-4 h-4" />}
            Emergency Kill Switch
          </button>
        </div>
      </div>

      {showCreate && (
        <div className="card mb-8">
          <h3 className="text-lg font-semibold mb-4">Create Trading Bot</h3>
          <div className="grid sm:grid-cols-3 gap-4">
            <div>
              <label className="label">Strategy Model</label>
              <select className="input-field" value={newBot.modelId} onChange={(e) => setNewBot({ ...newBot, modelId: e.target.value })}>
                <option value="">Select model</option>
                {modelList.map((m) => (
                  <option key={m.id} value={m.id}>{m.name} ({m.win_rate}% WR)</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Bot Name</label>
              <input className="input-field" value={newBot.name} onChange={(e) => setNewBot({ ...newBot, name: e.target.value })} placeholder="My Trading Bot" />
            </div>
            <div>
              <label className="label">Max Daily Loss ($)</label>
              <input type="number" className="input-field mono-data" value={newBot.maxDailyLoss} onChange={(e) => setNewBot({ ...newBot, maxDailyLoss: Number(e.target.value) })} />
            </div>
          </div>
          <div className="flex gap-3 mt-4">
            <button onClick={handleCreate} className="btn-success">Create Bot</button>
            <button onClick={() => setShowCreate(false)} className="btn-ghost">Cancel</button>
          </div>
        </div>
      )}

      <div className="grid lg:grid-cols-2 gap-8 mb-8">
        <div className="card">
          <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <Bot className="w-5 h-5 text-accent-cyan" />
            Active Bots
          </h3>
          {loading ? (
            <div className="space-y-3">{[1, 2].map((i) => <div key={i} className="skeleton h-24" />)}</div>
          ) : botList.length === 0 ? (
            <p className="text-zinc-500 text-center py-8">No bots created yet</p>
          ) : (
            <div className="space-y-4">
              {botList.map((bot) => (
                <div key={bot.id} className="p-4 rounded-lg bg-zinc-900/50 border border-border">
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <p className="font-medium">{bot.name}</p>
                      <p className="text-xs text-zinc-500">{bot.model_name} · WR: <span className="mono-data">{bot.win_rate}%</span></p>
                    </div>
                    <BotStatusBadge status={bot.status} />
                  </div>

                  <div className="mb-3">
                    <label className="label">Max Daily Loss: <span className="mono-data text-white">${bot.max_daily_loss}</span></label>
                    <input
                      type="range"
                      min={100}
                      max={10000}
                      step={100}
                      value={bot.max_daily_loss}
                      onChange={(e) => handleRiskChange(bot.id, Number(e.target.value))}
                      className="w-full accent-emerald-500"
                    />
                    <div className="flex justify-between text-xs text-zinc-500 mono-data">
                      <span>$100</span>
                      <span>Current P&L: <span className={parseFloat(String(bot.current_daily_pnl)) >= 0 ? 'text-emerald-400' : 'text-red-400'}>${parseFloat(String(bot.current_daily_pnl)).toFixed(2)}</span></span>
                      <span>$10,000</span>
                    </div>
                  </div>

                  <div className="flex gap-2">
                    {bot.status === 'active' ? (
                      <button onClick={() => handleStop(bot.id)} className="btn-ghost border border-border flex items-center gap-1 text-sm">
                        <Square className="w-3 h-3" /> Stop
                      </button>
                    ) : (
                      <button onClick={() => handleStart(bot.id)} className="btn-success flex items-center gap-1 text-sm py-1.5 px-3">
                        <Play className="w-3 h-3" /> Start
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="card">
          <h3 className="text-lg font-semibold mb-4">Execution Logs</h3>
          {loading ? (
            <div className="space-y-2">{[1, 2, 3, 4, 5].map((i) => <div key={i} className="skeleton h-10" />)}</div>
          ) : logs.length === 0 ? (
            <p className="text-zinc-500 text-center py-8">No execution logs yet</p>
          ) : (
            <div className="overflow-x-auto max-h-[500px] overflow-y-auto">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-surface">
                  <tr className="border-b border-border">
                    <th className="text-left py-2 px-2 text-zinc-400 font-medium">Time</th>
                    <th className="text-left py-2 px-2 text-zinc-400 font-medium">Action</th>
                    <th className="text-left py-2 px-2 text-zinc-400 font-medium">Symbol</th>
                    <th className="text-left py-2 px-2 text-zinc-400 font-medium">Status</th>
                    <th className="text-left py-2 px-2 text-zinc-400 font-medium">Message</th>
                  </tr>
                </thead>
                <tbody>
                  {logs.map((log) => (
                    <tr key={log.id} className="border-b border-border/30 hover:bg-zinc-900/50">
                      <td className="py-2 px-2 mono-data text-zinc-400 text-xs whitespace-nowrap">
                        {new Date(log.created_at).toLocaleTimeString()}
                      </td>
                      <td className={`py-2 px-2 mono-data font-medium ${
                        log.action === 'BUY' ? 'text-emerald-400' : log.action === 'SELL' ? 'text-red-400' : 'text-zinc-300'
                      }`}>
                        {log.action}
                      </td>
                      <td className="py-2 px-2 mono-data">{log.symbol || '—'}</td>
                      <td className="py-2 px-2">
                        <span className={`text-xs ${log.status === 'success' ? 'text-emerald-400' : log.status === 'failed' ? 'text-red-400' : 'text-zinc-400'}`}>
                          {log.status}
                        </span>
                      </td>
                      <td className="py-2 px-2 text-xs text-zinc-500 max-w-[200px] truncate">{log.message || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
