const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';

function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('token');
}

export async function api<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = {
    ...(options.headers as Record<string, string>),
  };

  if (!(options.body instanceof FormData)) {
    headers['Content-Type'] = 'application/json';
  }

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(`${API_URL}${endpoint}`, {
    ...options,
    headers,
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data.error || `Request failed: ${response.status}`);
  }

  return data as T;
}

export const auth = {
  register: (email: string, password: string, fullName?: string) =>
    api<{ user: User; token: string }>('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ email, password, fullName }),
    }),

  login: (email: string, password: string) =>
    api<{ user: User; token: string }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    }),

  me: () => api<{ user: User }>('/auth/me'),
};

export const dashboard = {
  summary: () => api<DashboardSummary>('/dashboard/summary'),
};

export const datasets = {
  list: () => api<{ datasets: Dataset[] }>('/datasets'),
  upload: (file: File, name?: string) => {
    const form = new FormData();
    form.append('file', file);
    if (name) form.append('name', name);
    return api<{ dataset: Dataset; preview: DatasetPreview }>('/datasets/upload', {
      method: 'POST',
      body: form,
    });
  },
  preview: (id: string) =>
    api<{ dataset: Dataset; preview: DatasetPreview }>(`/datasets/${id}/preview`),
  parse: (id: string, columnMapping: ColumnMapping) =>
    api<{ dataset: Dataset; parseResult: ParseResult }>(`/datasets/${id}/parse`, {
      method: 'POST',
      body: JSON.stringify({ columnMapping }),
    }),
  delete: (id: string) =>
    api<{ success: boolean }>(`/datasets/${id}`, { method: 'DELETE' }),
};

export const models = {
  list: () => api<{ models: StrategyModel[] }>('/models'),
  get: (id: string) => api<{ model: StrategyModel }>(`/models/${id}`),
  train: (datasetId: string, name?: string) =>
    api<{ model: StrategyModel }>('/models/train', {
      method: 'POST',
      body: JSON.stringify({ datasetId, name }),
    }),
  delete: (id: string) =>
    api<{ success: boolean }>(`/models/${id}`, { method: 'DELETE' }),
};

export const broker = {
  get: () => api<{ credentials: BrokerCredential[] }>('/broker'),
  save: (data: { apiKey: string; apiSecret: string; isPaperTrading?: boolean }) =>
    api<{ credentials: BrokerCredential }>('/broker', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  test: () => api<BrokerTestResult>('/broker/test', { method: 'POST' }),
  setPaperTrading: (isPaperTrading: boolean) =>
    api<{ credentials: BrokerCredential }>('/broker/paper-trading', {
      method: 'PATCH',
      body: JSON.stringify({ isPaperTrading }),
    }),
};

export const bots = {
  list: () => api<{ bots: TradingBot[] }>('/bots'),
  create: (data: { modelId: string; name?: string; maxDailyLoss?: number }) =>
    api<{ bot: TradingBot }>('/bots', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  start: (id: string) =>
    api<{ bot: TradingBot }>(`/bots/${id}/start`, { method: 'PATCH' }),
  stop: (id: string) =>
    api<{ bot: TradingBot }>(`/bots/${id}/stop`, { method: 'PATCH' }),
  updateRisk: (id: string, maxDailyLoss: number) =>
    api<{ bot: TradingBot }>(`/bots/${id}/risk`, {
      method: 'PATCH',
      body: JSON.stringify({ maxDailyLoss }),
    }),
  killSwitch: () =>
    api<{ success: boolean; botsStopped: number }>('/bots/kill-switch', { method: 'POST' }),
  logs: (limit?: number) =>
    api<{ logs: ExecutionLog[] }>(`/bots/logs${limit ? `?limit=${limit}` : ''}`),
};

export interface User {
  id: string;
  email: string;
  full_name?: string;
  created_at: string;
}

export interface DashboardSummary {
  activeModels: number;
  totalDatasets: number;
  activeBots: number;
  executionsToday: number;
  broker: { connection_status: string; is_paper_trading: boolean };
}

export interface Dataset {
  id: string;
  name: string;
  original_filename: string;
  row_count: number;
  status: string;
  column_mapping?: ColumnMapping;
  error_message?: string;
  created_at: string;
}

export interface ColumnMapping {
  timestamp: string;
  symbol: string;
  entry_price: string;
  exit_price: string;
  pnl?: string;
  side?: string;
}

export interface DatasetPreview {
  columns: string[];
  preview: Record<string, string>[];
  totalRows: number;
}

export interface ParseResult {
  validCount: number;
  skipped: number;
  errors: string[];
}

export interface StrategyModel {
  id: string;
  name: string;
  dataset_id: string;
  dataset_name?: string;
  status: string;
  win_rate?: number;
  avg_risk_reward?: number;
  avg_trade_duration_minutes?: number;
  preferred_asset_classes?: { class: string; count: number; percentage: number }[];
  ruleset?: Record<string, unknown>;
  metrics?: Record<string, unknown>;
  created_at: string;
}

export interface BrokerCredential {
  id: string;
  broker_name: string;
  is_paper_trading: boolean;
  is_active: boolean;
  connection_status: string;
  last_tested_at?: string;
}

export interface BrokerTestResult {
  connected: boolean;
  accountId?: string;
  status?: string;
  buyingPower?: string;
  equity?: string;
  paper?: boolean;
  error?: string;
}

export interface TradingBot {
  id: string;
  name: string;
  model_id: string;
  model_name?: string;
  win_rate?: number;
  status: string;
  max_daily_loss: number;
  current_daily_pnl: number;
  created_at: string;
}

export interface ExecutionLog {
  id: string;
  bot_id?: string;
  bot_name?: string;
  action: string;
  symbol?: string;
  quantity?: number;
  price?: number;
  status: string;
  message?: string;
  created_at: string;
}
