'use client';

import { useCallback, useEffect, useState } from 'react';
import { Upload, FileSpreadsheet, Trash2, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { datasets, Dataset, ColumnMapping, DatasetPreview } from '@/lib/api';

const REQUIRED_FIELDS: (keyof ColumnMapping)[] = ['timestamp', 'symbol', 'entry_price', 'exit_price'];
const OPTIONAL_FIELDS: (keyof ColumnMapping)[] = ['pnl', 'side'];

const FIELD_LABELS: Record<string, string> = {
  timestamp: 'Timestamp',
  symbol: 'Asset Symbol',
  entry_price: 'Entry Price',
  exit_price: 'Exit Price',
  pnl: 'P&L',
  side: 'Side (buy/sell)',
};

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    processed: 'status-active',
    processing: 'status-badge bg-amber-500/10 text-amber-400 border border-amber-500/20',
    failed: 'status-error',
    uploaded: 'status-badge bg-blue-500/10 text-blue-400 border border-blue-500/20',
    pending: 'status-inactive',
  };
  return <span className={map[status] || 'status-inactive'}>{status}</span>;
}

export default function DatasetsPage() {
  const [datasetList, setDatasetList] = useState<Dataset[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [mappingDataset, setMappingDataset] = useState<Dataset | null>(null);
  const [preview, setPreview] = useState<DatasetPreview | null>(null);
  const [columnMapping, setColumnMapping] = useState<Partial<ColumnMapping>>({});
  const [parsing, setParsing] = useState(false);

  const loadDatasets = useCallback(async () => {
    try {
      const { datasets: list } = await datasets.list();
      setDatasetList(list);
    } catch {
      toast.error('Failed to load datasets');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadDatasets(); }, [loadDatasets]);

  async function handleFile(file: File) {
    if (!file.name.endsWith('.csv')) {
      toast.error('Only CSV files are supported');
      return;
    }
    setUploading(true);
    try {
      const result = await datasets.upload(file);
      toast.success('Dataset uploaded successfully');
      setMappingDataset(result.dataset);
      setPreview(result.preview);
      autoMapColumns(result.preview.columns);
      loadDatasets();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setUploading(false);
    }
  }

  function autoMapColumns(columns: string[]) {
    const mapping: Partial<ColumnMapping> = {};
    const lower = columns.map((c) => c.toLowerCase());
    const find = (...terms: string[]) => columns[lower.findIndex((c) => terms.some((t) => c.includes(t)))];

    mapping.timestamp = find('timestamp', 'date', 'time', 'datetime') || '';
    mapping.symbol = find('symbol', 'ticker', 'asset') || '';
    mapping.entry_price = find('entry', 'open', 'buy_price') || '';
    mapping.exit_price = find('exit', 'close', 'sell_price') || '';
    mapping.pnl = find('pnl', 'profit', 'loss', 'return') || '';
    mapping.side = find('side', 'direction', 'type') || '';
    setColumnMapping(mapping);
  }

  async function handleParse() {
    if (!mappingDataset) return;
    for (const field of REQUIRED_FIELDS) {
      if (!columnMapping[field]) {
        toast.error(`Please map the ${FIELD_LABELS[field]} column`);
        return;
      }
    }
    setParsing(true);
    try {
      await datasets.parse(mappingDataset.id, columnMapping as ColumnMapping);
      toast.success('Dataset successfully parsed');
      setMappingDataset(null);
      setPreview(null);
      loadDatasets();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Parsing failed');
    } finally {
      setParsing(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this dataset?')) return;
    try {
      await datasets.delete(id);
      toast.success('Dataset deleted');
      loadDatasets();
    } catch {
      toast.error('Failed to delete dataset');
    }
  }

  async function openMapping(ds: Dataset) {
    try {
      const result = await datasets.preview(ds.id);
      setMappingDataset(result.dataset);
      setPreview(result.preview);
      autoMapColumns(result.preview.columns);
    } catch {
      toast.error('Failed to load preview');
    }
  }

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold mb-1">Datasets</h1>
        <p className="text-zinc-400">Upload and parse your historical trading data</p>
      </div>

      <div
        className={`card border-2 border-dashed mb-8 transition-all duration-200 ${
          dragOver ? 'border-accent-cyan bg-accent-cyan/5' : 'border-border'
        }`}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          const file = e.dataTransfer.files[0];
          if (file) handleFile(file);
        }}
      >
        <div className="flex flex-col items-center py-10">
          {uploading ? (
            <Loader2 className="w-10 h-10 text-accent-cyan animate-spin mb-4" />
          ) : (
            <Upload className="w-10 h-10 text-zinc-500 mb-4" />
          )}
          <p className="text-lg font-medium mb-1">Drag & drop your CSV file here</p>
          <p className="text-sm text-zinc-500 mb-4">or click to browse</p>
          <label className="btn-primary cursor-pointer">
            Select CSV File
            <input
              type="file"
              accept=".csv"
              className="hidden"
              onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
            />
          </label>
        </div>
      </div>

      {mappingDataset && preview && (
        <div className="card mb-8">
          <h3 className="text-lg font-semibold mb-4">Column Mapping — {mappingDataset.name}</h3>
          <p className="text-sm text-zinc-400 mb-4">
            {preview.totalRows} rows detected. Map CSV columns to required fields.
          </p>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
            {[...REQUIRED_FIELDS, ...OPTIONAL_FIELDS].map((field) => (
              <div key={field}>
                <label className="label">
                  {FIELD_LABELS[field]}
                  {REQUIRED_FIELDS.includes(field) && <span className="text-red-400 ml-1">*</span>}
                </label>
                <select
                  className="input-field"
                  value={columnMapping[field] || ''}
                  onChange={(e) => setColumnMapping({ ...columnMapping, [field]: e.target.value })}
                >
                  <option value="">— Select column —</option>
                  {preview.columns.map((col) => (
                    <option key={col} value={col}>{col}</option>
                  ))}
                </select>
              </div>
            ))}
          </div>

          {preview.preview.length > 0 && (
            <div className="overflow-x-auto mb-6">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    {preview.columns.map((col) => (
                      <th key={col} className="text-left py-2 px-3 text-zinc-400 font-medium">{col}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {preview.preview.slice(0, 3).map((row, i) => (
                    <tr key={i} className="border-b border-border/50">
                      {preview.columns.map((col) => (
                        <td key={col} className="py-2 px-3 mono-data text-zinc-300">{row[col]}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="flex gap-3">
            <button onClick={handleParse} className="btn-success" disabled={parsing}>
              {parsing ? 'Parsing...' : 'Parse & Ingest'}
            </button>
            <button onClick={() => { setMappingDataset(null); setPreview(null); }} className="btn-ghost">
              Cancel
            </button>
          </div>
        </div>
      )}

      <div className="card">
        <h3 className="text-lg font-semibold mb-4">Your Datasets</h3>
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => <div key={i} className="skeleton h-14 w-full" />)}
          </div>
        ) : datasetList.length === 0 ? (
          <p className="text-zinc-500 text-center py-8">No datasets uploaded yet</p>
        ) : (
          <div className="space-y-2">
            {datasetList.map((ds) => (
              <div key={ds.id} className="flex items-center justify-between p-4 rounded-lg bg-zinc-900/50 hover:bg-zinc-900 transition-colors">
                <div className="flex items-center gap-3">
                  <FileSpreadsheet className="w-5 h-5 text-zinc-500" />
                  <div>
                    <p className="font-medium">{ds.name}</p>
                    <p className="text-xs text-zinc-500">
                      {ds.original_filename} · <span className="mono-data">{ds.row_count}</span> rows
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <StatusBadge status={ds.status} />
                  {ds.status === 'uploaded' && (
                    <button onClick={() => openMapping(ds)} className="text-xs text-accent-cyan hover:underline">
                      Map Columns
                    </button>
                  )}
                  {ds.status === 'processed' && <CheckCircle className="w-4 h-4 text-emerald-400" />}
                  {ds.status === 'failed' && <AlertCircle className="w-4 h-4 text-red-400" />}
                  <button onClick={() => handleDelete(ds.id)} className="text-zinc-500 hover:text-red-400 transition-colors">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
