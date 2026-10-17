'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function BrokerConnectPage() {
  const [broker, setBroker] = useState('deriv');
  const [accountId, setAccountId] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState('');
  const router = useRouter();

  const handleConnect = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsConnecting(true);
    setError('');

    try {
      // Call your backend API to link the helper/bot API key securely
      // Remember: Deposits/withdrawals happen on the broker app; this is strictly for trading helper sync.
      const res = await fetch('/api/broker/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ broker, accountId, apiKey }),
      });

      if (!res.ok) {
        throw new Error('Failed to connect broker helper. Please check your credentials.');
      }

      router.push('/dashboard/broker');
    } catch (err: any) {
      setError(err.message || 'An error occurred');
    } finally {
      setIsConnecting(false);
    }
  };

  return (
    <div className="max-w-xl mx-auto p-6 bg-gray-900 text-white rounded-xl shadow-lg mt-10">
      <h1 className="text-2xl font-bold mb-2">Connect Trading Helper</h1>
      <p className="text-gray-400 text-sm mb-6">
        Link your external trading account API so your automated helper can execute trades on your behalf. 
        Note: Cashing in and out is handled directly inside your official trading app.
      </p>

      {error && <div className="bg-red-500/20 border border-red-500 text-red-300 p-3 rounded mb-4 text-sm">{error}</div>}

      <form onSubmit={handleConnect} className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-1">Select Broker</label>
          <select 
            value={broker} 
            onChange={(e) => setBroker(e.target.value)}
            className="w-full bg-gray-800 border border-gray-700 rounded p-2.5 text-white"
          >
            <option value="deriv">Deriv (Binary/Deriv X)</option>
            <option value="metatrader">MetaTrader 5 (MT5)</option>
            <option value="option_broker">Other Supported Broker</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Account ID / Login</label>
          <input 
            type="text" 
            value={accountId} 
            onChange={(e) => setAccountId(e.target.value)}
            placeholder="e.g. CR1234567" 
            required
            className="w-full bg-gray-800 border border-gray-700 rounded p-2.5 text-white"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">API Token / Connection Key</label>
          <input 
            type="password" 
            value={apiKey} 
            onChange={(e) => setApiKey(e.target.value)}
            placeholder="Enter your read/trade API token" 
            required
            className="w-full bg-gray-800 border border-gray-700 rounded p-2.5 text-white"
          />
          <p className="text-xs text-gray-500 mt-1">You can generate this token from your broker account settings.</p>
        </div>

        <button 
          type="submit" 
          disabled={isConnecting}
          className="w-full bg-blue-600 hover:bg-blue-500 text-white font-semibold py-2.5 rounded transition disabled:opacity-50"
        >
          {isConnecting ? 'Linking Helper...' : 'Link Trading Account'}
        </button>
      </form>
    </div>
  );
}
