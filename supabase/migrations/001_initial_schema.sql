-- Strat-Clone Engine Database Schema
-- Run this in Supabase SQL Editor or via migration tool

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Users table (extends Supabase auth.users or standalone)
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  full_name VARCHAR(255),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Broker credentials (encrypted API keys)
CREATE TABLE IF NOT EXISTS broker_credentials (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  broker_name VARCHAR(100) NOT NULL DEFAULT 'alpaca',
  api_key_encrypted TEXT NOT NULL,
  api_secret_encrypted TEXT NOT NULL,
  is_paper_trading BOOLEAN DEFAULT TRUE,
  is_active BOOLEAN DEFAULT FALSE,
  last_tested_at TIMESTAMPTZ,
  connection_status VARCHAR(50) DEFAULT 'disconnected',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, broker_name)
);

-- Trade datasets (uploaded CSV files)
CREATE TABLE IF NOT EXISTS trade_datasets (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  original_filename VARCHAR(500) NOT NULL,
  file_path TEXT,
  row_count INTEGER DEFAULT 0,
  status VARCHAR(50) DEFAULT 'pending',
  column_mapping JSONB,
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Normalized parsed trade rows
CREATE TABLE IF NOT EXISTS parsed_trades (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  dataset_id UUID NOT NULL REFERENCES trade_datasets(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  timestamp TIMESTAMPTZ NOT NULL,
  symbol VARCHAR(20) NOT NULL,
  entry_price DECIMAL(18, 8) NOT NULL,
  exit_price DECIMAL(18, 8) NOT NULL,
  pnl DECIMAL(18, 8),
  side VARCHAR(10),
  duration_minutes INTEGER,
  asset_class VARCHAR(50),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_parsed_trades_dataset ON parsed_trades(dataset_id);
CREATE INDEX idx_parsed_trades_user ON parsed_trades(user_id);

-- Strategy models (ML-extracted behavioral patterns)
CREATE TABLE IF NOT EXISTS strategy_models (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  dataset_id UUID NOT NULL REFERENCES trade_datasets(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  status VARCHAR(50) DEFAULT 'training',
  win_rate DECIMAL(5, 2),
  avg_risk_reward DECIMAL(8, 4),
  avg_trade_duration_minutes INTEGER,
  preferred_asset_classes JSONB,
  ruleset JSONB,
  metrics JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_strategy_models_user ON strategy_models(user_id);

-- Trading bots
CREATE TABLE IF NOT EXISTS trading_bots (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  model_id UUID NOT NULL REFERENCES strategy_models(id) ON DELETE CASCADE,
  broker_credential_id UUID REFERENCES broker_credentials(id) ON DELETE SET NULL,
  name VARCHAR(255) NOT NULL,
  status VARCHAR(50) DEFAULT 'inactive',
  max_daily_loss DECIMAL(18, 8) DEFAULT 1000,
  current_daily_pnl DECIMAL(18, 8) DEFAULT 0,
  risk_reset_at DATE DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_trading_bots_user ON trading_bots(user_id);
CREATE INDEX idx_trading_bots_status ON trading_bots(status);

-- Execution logs
CREATE TABLE IF NOT EXISTS execution_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  bot_id UUID REFERENCES trading_bots(id) ON DELETE SET NULL,
  model_id UUID REFERENCES strategy_models(id) ON DELETE SET NULL,
  action VARCHAR(20) NOT NULL,
  symbol VARCHAR(20),
  quantity DECIMAL(18, 8),
  price DECIMAL(18, 8),
  status VARCHAR(50) NOT NULL,
  broker_response JSONB,
  message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_execution_logs_user ON execution_logs(user_id);
CREATE INDEX idx_execution_logs_bot ON execution_logs(bot_id);
CREATE INDEX idx_execution_logs_created ON execution_logs(created_at DESC);

-- Updated_at trigger
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER users_updated_at BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER broker_credentials_updated_at BEFORE UPDATE ON broker_credentials
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trade_datasets_updated_at BEFORE UPDATE ON trade_datasets
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER strategy_models_updated_at BEFORE UPDATE ON strategy_models
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trading_bots_updated_at BEFORE UPDATE ON trading_bots
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
