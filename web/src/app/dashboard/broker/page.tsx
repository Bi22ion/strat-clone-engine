'use client';

import { useCallback, useEffect, useState } from 'react';
import { Link2, Shield, Wifi, WifiOff, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { broker, BrokerCredential } from '@/lib/api';

export default function BrokerPage() {
  const [credentials, setCredentials] = useState<BrokerCredential | null>(null);
  const [apiKey, setApiKey] = useState('');
  const [apiSecret, setApiSecret] = useState('');
  const [isPaperTrading, setIsPaperTrading] = useState(true);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);

  const load = useCallback(async () => {
    try {
      const { credentials: creds } = await broker.get();
      if (creds.length > 0) {
        setCredentials(creds[0]);
        setIsPaperTrading(creds[0].is_paper_trading);
      }
    } catch {
      toast.error('Failed to load broker settings');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!apiKey || !apiSecret) {
      toast.error('API key and secret are required');
      return;
    }
    setSaving(true);
    try {
      const { credentials: cred } = await broker.save({ apiKey, apiSecret, isPaperTrading });
      setCredentials(cred);
      setApiKey('');
      setApiSecret('');
      toast.success('Broker credentials saved securely');
      load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  }

  async function handleTest() {
    setTesting(true);
    try {
      const result = await broker.test();
      if (result.connected) {
        toast.success(`Broker connection verified — Equity: $${result.equity}`);
      } else {
        toast.error(result.error || 'Connection failed');
      }
      load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Test failed');
    } finally {
      setTesting(false);
    }
  }

  async function togglePaperTrading(value: boolean) {
    setIsPaperTrading(value);
    if (credentials) {
      try {
        await broker.setPaperTrading(value);
        toast.success(value ? 'Switched to paper trading' : 'Switched to live trading');
        load();
      } catch {
        toast.error('Failed to update setting');
      }
    }
  }

  const isConnected = credentials?.connection_status === 'connected';

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold mb-1">Broker Configuration</h1>
        <p className="text-zinc-400">Connect your broker API for automated trade execution</p>
      </div>

      <div className="grid lg:grid-cols-2 gap-8">
        <form onSubmit={handleSave} className="card">
          <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <Link2 className="w-5 h-5 text-accent-cyan" />
            Alpaca API Credentials
          </h3>

          <div className="flex items-center gap-2 p-3 rounded-lg bg-zinc-900 mb-6 text-sm text-zinc-400">
            <Shield className="w-4 h-4 text-emerald-400 shrink-0" />
            API keys are encrypted with AES-256-GCM before storage
          </div>

          <div className="space-y-4 mb-6">
            <div>
              <label className="label">API Key</label>
              <input
                type="password"
                className="input-field font-mono"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder={credentials ? '••••••••••••••••' : 'PK...'}
              />
            </div>
            <div>
              <label className="label">API Secret</label>
              <input
                type="password"
                className="input-field font-mono"
                value={apiSecret}
                onChange={(e) => setApiSecret(e.target.value)}
                placeholder={credentials ? '••••••••••••••••' : 'Secret key'}
              />
            </div>
          </div>

          <div className="mb-6">
            <label className="label mb-3">Trading Mode</label>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => togglePaperTrading(true)}
                className={`flex-1 py-3 rounded-lg border text-sm font-medium transition-all ${
                  isPaperTrading
                    ? 'border-emerald-500/50 bg-emerald-500/10 text-emerald-400'
                    : 'border-border text-zinc-400 hover:bg-surface-hover'
                }`}
              >
                Paper Trading
              </button>
              <button
                type="button"
                onClick={() => togglePaperTrading(false)}
                className={`flex-1 py-3 rounded-lg border text-sm font-medium transition-all ${
                  !isPaperTrading
                    ? 'border-red-500/50 bg-red-500/10 text-red-400'
                    : 'border-border text-zinc-400 hover:bg-surface-hover'
                }`}
              >
                Live Trading
              </button>
            </div>
          </div>

          <div className="flex gap-3">
            <button type="submit" className="btn-primary" disabled={saving}>
              {saving ? 'Saving...' : 'Save Credentials'}
            </button>
            {credentials && (
              <button type="button" onClick={handleTest} className="btn-ghost border border-border" disabled={testing}>
                {testing ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Test Connection'}
              </button>
            )}
          </div>
        </form>

        <div className="card">
          <h3 className="text-lg font-semibold mb-4">Connection Status</h3>
          {loading ? (
            <div className="skeleton h-32" />
          ) : !credentials ? (
            <div className="text-center py-12">
              <WifiOff className="w-12 h-12 text-zinc-600 mx-auto mb-4" />
              <p className="text-zinc-400">No broker configured</p>
              <p className="text-sm text-zinc-500 mt-1">Add your Alpaca API credentials to get started</p>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center gap-3 p-4 rounded-lg bg-zinc-900">
                {isConnected ? <Wifi className="w-6 h-6 text-emerald-400" /> : <WifiOff className="w-6 h-6 text-red-400" />}
                <div>
                  <p className="font-medium capitalize">{credentials.connection_status}</p>
                  <p className="text-xs text-zinc-500">
                    {credentials.broker_name} · {credentials.is_paper_trading ? 'Paper' : 'Live'}
                  </p>
                </div>
                {isConnected ? <span className="pulse-dot-green ml-auto" /> : <span className="pulse-dot-red ml-auto" />}
              </div>

              {credentials.last_tested_at && (
                <p className="text-xs text-zinc-500">
                  Last tested: {new Date(credentials.last_tested_at).toLocaleString()}
                </p>
              )}

              <div className="border-t border-border pt-4">
                <h4 className="text-sm font-medium text-zinc-400 mb-2">Setup Guide</h4>
                <ol className="text-sm text-zinc-500 space-y-2 list-decimal list-inside">
                  <li>Create an account at <span className="text-zinc-300">alpaca.markets</span></li>
                  <li>Generate API keys from the dashboard</li>
                  <li>Use paper trading keys for testing</li>
                  <li>Save credentials and test the connection</li>
                </ol>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
