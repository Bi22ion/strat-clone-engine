'use client';

import { useCallback, useEffect, useState } from 'react';
import { Brain, Play, Trash2, Loader2, TrendingUp, Target, Clock } from 'lucide-react';
import toast from 'react-hot-toast';
import { models, datasets, StrategyModel, Dataset } from '@/lib/api';

export default function ModelsPage() {
  const [modelList, setModelList] = useState<StrategyModel[]>([]);
  const [datasetList, setDatasetList] = useState<Dataset[]>([]);
  const [loading, setLoading] = useState(true);
  const [training, setTraining] = useState(false);
  const [selectedDataset, setSelectedDataset] = useState('');
  const [modelName, setModelName] = useState('');
  const [selectedModel, setSelectedModel] = useState<StrategyModel | null>(null);

  const load = useCallback(async () => {
    try {
      const [m, d] = await Promise.all([models.list(), datasets.list()]);
      setModelList(m.models);
      setDatasetList(d.datasets.filter((ds) => ds.status === 'processed'));
    } catch {
      toast.error('Failed to load data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function handleTrain() {
    if (!selectedDataset) {
      toast.error('Select a processed dataset');
      return;
    }
    setTraining(true);
    try {
      const { model } = await models.train(selectedDataset, modelName || undefined);
      toast.success('Model training complete');
      setSelectedModel(model);
      setModelName('');
      load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Training failed');
    } finally {
      setTraining(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this model?')) return;
    try {
      await models.delete(id);
      toast.success('Model deleted');
      if (selectedModel?.id === id) setSelectedModel(null);
      load();
    } catch {
      toast.error('Failed to delete model');
    }
  }

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold mb-1">Strategy Models</h1>
        <p className="text-zinc-400">Train behavioral ML models from your trade history</p>
      </div>

      <div className="card mb-8">
        <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <Brain className="w-5 h-5 text-accent-cyan" />
          Train New Model
        </h3>
        <div className="grid sm:grid-cols-3 gap-4 mb-4">
          <div>
            <label className="label">Dataset</label>
            <select
              className="input-field"
              value={selectedDataset}
              onChange={(e) => setSelectedDataset(e.target.value)}
            >
              <option value="">Select processed dataset</option>
              {datasetList.map((ds) => (
                <option key={ds.id} value={ds.id}>{ds.name} ({ds.row_count} rows)</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Model Name (optional)</label>
            <input
              className="input-field"
              value={modelName}
              onChange={(e) => setModelName(e.target.value)}
              placeholder="My Strategy Clone"
            />
          </div>
          <div className="flex items-end">
            <button onClick={handleTrain} className="btn-primary w-full flex items-center justify-center gap-2" disabled={training}>
              {training ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
              {training ? 'Training...' : 'Train Model'}
            </button>
          </div>
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-8">
        <div className="card">
          <h3 className="text-lg font-semibold mb-4">Your Models</h3>
          {loading ? (
            <div className="space-y-3">{[1, 2].map((i) => <div key={i} className="skeleton h-16" />)}</div>
          ) : modelList.length === 0 ? (
            <p className="text-zinc-500 text-center py-8">No models trained yet</p>
          ) : (
            <div className="space-y-2">
              {modelList.map((m) => (
                <div
                  key={m.id}
                  onClick={() => setSelectedModel(m)}
                  className={`p-4 rounded-lg cursor-pointer transition-all ${
                    selectedModel?.id === m.id ? 'bg-accent-cyan/10 border border-accent-cyan/30' : 'bg-zinc-900/50 hover:bg-zinc-900'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">{m.name}</p>
                      <p className="text-xs text-zinc-500">{m.dataset_name} · {m.status}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      {m.win_rate != null && (
                        <span className="mono-data text-emerald-400 text-sm">{m.win_rate}%</span>
                      )}
                      <button onClick={(e) => { e.stopPropagation(); handleDelete(m.id); }} className="text-zinc-500 hover:text-red-400">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="card">
          <h3 className="text-lg font-semibold mb-4">Model Analytics</h3>
          {!selectedModel ? (
            <p className="text-zinc-500 text-center py-8">Select a model to view analytics</p>
          ) : selectedModel.status !== 'ready' ? (
            <div className="flex items-center justify-center py-8 gap-2 text-zinc-400">
              <Loader2 className="w-5 h-5 animate-spin" />
              Model is {selectedModel.status}...
            </div>
          ) : (
            <div className="space-y-6">
              <div className="grid grid-cols-3 gap-4">
                <div className="bg-zinc-900 rounded-lg p-4 text-center">
                  <TrendingUp className="w-5 h-5 text-emerald-400 mx-auto mb-2" />
                  <p className="text-2xl font-bold mono-data text-emerald-400">{selectedModel.win_rate}%</p>
                  <p className="text-xs text-zinc-500">Win Rate</p>
                </div>
                <div className="bg-zinc-900 rounded-lg p-4 text-center">
                  <Target className="w-5 h-5 text-accent-cyan mx-auto mb-2" />
                  <p className="text-2xl font-bold mono-data text-accent-cyan">{selectedModel.avg_risk_reward}</p>
                  <p className="text-xs text-zinc-500">Risk/Reward</p>
                </div>
                <div className="bg-zinc-900 rounded-lg p-4 text-center">
                  <Clock className="w-5 h-5 text-amber-400 mx-auto mb-2" />
                  <p className="text-2xl font-bold mono-data text-amber-400">{selectedModel.avg_trade_duration_minutes}m</p>
                  <p className="text-xs text-zinc-500">Avg Duration</p>
                </div>
              </div>

              {selectedModel.preferred_asset_classes && (
                <div>
                  <h4 className="text-sm font-medium text-zinc-400 mb-2">Preferred Asset Classes</h4>
                  <div className="flex flex-wrap gap-2">
                    {(typeof selectedModel.preferred_asset_classes === 'string'
                      ? JSON.parse(selectedModel.preferred_asset_classes)
                      : selectedModel.preferred_asset_classes
                    ).map((a: { class: string; percentage: number }) => (
                      <span key={a.class} className="status-active capitalize">
                        {a.class} ({a.percentage.toFixed(0)}%)
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {selectedModel.ruleset && (
                <div>
                  <h4 className="text-sm font-medium text-zinc-400 mb-2">Generated Ruleset</h4>
                  <pre className="bg-zinc-900 rounded-lg p-4 text-xs mono-data text-zinc-300 overflow-x-auto max-h-64">
                    {JSON.stringify(
                      typeof selectedModel.ruleset === 'string' ? JSON.parse(selectedModel.ruleset) : selectedModel.ruleset,
                      null, 2
                    )}
                  </pre>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
