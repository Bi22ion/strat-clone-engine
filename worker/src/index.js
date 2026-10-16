import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { AlpacaBroker } from '../../server/src/services/brokerService.js';
import { runOneEvaluation, emergencyStop } from './tradingEngine.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '../../.env') });
const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!supabaseUrl || !supabaseKey) throw new Error('Worker requires SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY');
const supabase = createClient(supabaseUrl, supabaseKey, { auth: { persistSession: false, autoRefreshToken: false } });
const POLL_INTERVAL_MS = Number(process.env.WORKER_POLL_INTERVAL || 30000);
const MAX_QUOTE_AGE_MS = Number(process.env.MAX_QUOTE_AGE_MS || 120000);
let cycleRunning = false;
let stopping = false;

const repository = {
  async logDecision({ bot, decision, risk }) {
    await supabase.from('execution_logs').insert({ user_id: bot.user_id, bot_id: bot.id, model_id: bot.model_id, action: decision.action || 'NO_TRADE', symbol: decision.symbol, quantity: decision.quantity, price: decision.referencePrice, status: risk.approved ? 'approved' : 'rejected', message: risk.approved ? 'Risk approved decision' : `Risk rejected: ${risk.reason}`, broker_response: { data_timestamp: decision.dataTimestamp, reason: decision.reason } });
  },
  async persistOrder({ bot, decision, result, clientOrderId }) {
    const { data, error } = await supabase.from('trading_orders').insert({ user_id: bot.user_id, bot_id: bot.id, client_order_id: clientOrderId, broker_order_id: result.brokerOrderId || null, symbol: decision.symbol, side: 'buy', quantity: decision.quantity, status: result.status || 'rejected', paper_trading: true }).select('id').single();
    if (error) throw error;
    result.databaseOrderId = data.id;
  },
  async persistFill({ bot, result, fill }) {
    if (!result.databaseOrderId || fill.state === 'pending') return;
    const { error } = await supabase.from('trading_fills').insert({ user_id: bot.user_id, order_id: result.databaseOrderId, broker_fill_id: result.brokerOrderId, quantity: fill.filledQuantity, price: fill.averagePrice, status: fill.state });
    if (error) throw error;
  },
  async findOrderByClientOrderId(clientOrderId) {
    const { data, error } = await supabase.from('trading_orders').select('id, client_order_id').eq('client_order_id', clientOrderId).maybeSingle();
    if (error) throw error;
    return data;
  },
  async stopBots(ids) { if (ids.length) await supabase.from('trading_bots').update({ status: 'stopped_emergency', kill_switch: true }).in('id', ids); },
  async logEmergency(payload) {
    const { error } = await supabase.from('execution_logs').insert({ user_id: payload.userId || null, action: 'EMERGENCY_KILL', status: payload.ok ? 'executed' : 'partial_failure', message: payload.ok ? 'Emergency stop completed' : 'Emergency stop completed with broker failures', broker_response: payload });
    if (error) throw error;
  },
};

async function processActiveBots() {
  if (cycleRunning || stopping) return;
  cycleRunning = true;
  try {
    const { data: bots, error } = await supabase.from('trading_bots').select('*').eq('status', 'active').eq('kill_switch', false);
    if (error) throw error;
    for (const bot of bots || []) {
      const { data: model } = await supabase.from('strategy_models').select('*').eq('id', bot.model_id).eq('user_id', bot.user_id).maybeSingle();
      const { data: cred } = await supabase.from('broker_credentials').select('*').eq('id', bot.broker_credential_id).eq('user_id', bot.user_id).eq('is_paper_trading', true).maybeSingle();
      if (!model || !cred) continue;
      try {
        const broker = AlpacaBroker.fromCredentials(cred, { requirePaper: true });
        await runOneEvaluation({ bot, model, broker: { ...broker, getLatestQuote: async (symbol) => ({ symbol, price: await broker.getLatestPrice(symbol), timestamp: new Date().toISOString() }) }, repository, now: new Date() });
        await supabase.from('trading_bots').update({ last_heartbeat_at: new Date().toISOString(), last_evaluation_at: new Date().toISOString() }).eq('id', bot.id).eq('status', 'active');
      } catch (err) {
        await supabase.from('execution_logs').insert({ user_id: bot.user_id, bot_id: bot.id, action: 'WORKER_ERROR', status: 'failed', message: err.message });
      }
    }
  } finally { cycleRunning = false; }
}

console.log(`Strat-Clone paper execution worker started (poll interval: ${POLL_INTERVAL_MS}ms)`);
processActiveBots();
const timer = setInterval(processActiveBots, POLL_INTERVAL_MS);
async function shutdown(signal) { stopping = true; clearInterval(timer); console.log(`Worker shutting down after ${signal}`); process.exit(0); }
process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
export { processActiveBots };
