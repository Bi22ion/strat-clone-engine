-- Additive trading lifecycle records. No existing data is deleted or rewritten.
CREATE TABLE IF NOT EXISTS public.trading_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  bot_id uuid NOT NULL REFERENCES public.trading_bots(id) ON DELETE CASCADE,
  client_order_id text NOT NULL,
  broker_order_id text,
  symbol varchar(20) NOT NULL,
  side varchar(10) NOT NULL,
  quantity numeric(18,8) NOT NULL CHECK (quantity > 0),
  status varchar(30) NOT NULL DEFAULT 'pending',
  paper_trading boolean NOT NULL DEFAULT true,
  submitted_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(user_id, client_order_id)
);
ALTER TABLE public.trading_orders ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_trading_orders_user_bot ON public.trading_orders(user_id, bot_id, submitted_at DESC);

CREATE TABLE IF NOT EXISTS public.trading_fills (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  order_id uuid NOT NULL REFERENCES public.trading_orders(id) ON DELETE CASCADE,
  broker_fill_id text,
  quantity numeric(18,8) NOT NULL CHECK (quantity >= 0),
  price numeric(18,8),
  status varchar(30) NOT NULL,
  filled_at timestamptz DEFAULT now()
);
ALTER TABLE public.trading_fills ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_trading_fills_user ON public.trading_fills(user_id, filled_at DESC);

ALTER TABLE public.trading_bots ADD COLUMN IF NOT EXISTS kill_switch boolean NOT NULL DEFAULT false;
ALTER TABLE public.trading_bots ADD COLUMN IF NOT EXISTS max_open_positions integer NOT NULL DEFAULT 5;
ALTER TABLE public.trading_bots ADD COLUMN IF NOT EXISTS last_heartbeat_at timestamptz;
ALTER TABLE public.trading_bots ADD COLUMN IF NOT EXISTS last_evaluation_at timestamptz;

CREATE OR REPLACE FUNCTION public.update_trading_order_updated_at() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;
DROP TRIGGER IF EXISTS trading_orders_updated_at ON public.trading_orders;
CREATE TRIGGER trading_orders_updated_at BEFORE UPDATE ON public.trading_orders FOR EACH ROW EXECUTE FUNCTION public.update_trading_order_updated_at();
