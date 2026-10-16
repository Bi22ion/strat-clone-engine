import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { AlpacaBroker } from '../../server/src/services/brokerService.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '../../.env') });

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const POLL_INTERVAL_MS = parseInt(process.env.WORKER_POLL_INTERVAL) || 30000;

async function logExecution({ userId, botId, modelId, action, symbol, quantity, price, status, message, brokerResponse }) {
  await supabase.from('execution_logs').insert({
    user_id: userId,
    bot_id: botId,
    model_id: modelId,
    action,
    symbol,
    quantity,
    price,
    status,
    message,
    broker_response: brokerResponse ? JSON.stringify(brokerResponse) : null,
  });
}

async function resetDailyPnLIfNeeded(bot) {
  const today = new Date().toISOString().split('T')[0];
  if (bot.risk_reset_at !== today) {
    await supabase
      .from('trading_bots')
      .update({ current_daily_pnl: 0, risk_reset_at: today })
      .eq('id', bot.id);
    bot.current_daily_pnl = 0;
    bot.risk_reset_at = today;
  }
}

async function checkRiskGuardrail(bot) {
  await resetDailyPnLIfNeeded(bot);
  const dailyLoss = Math.abs(Math.min(parseFloat(bot.current_daily_pnl), 0));
  const maxLoss = parseFloat(bot.max_daily_loss);

  if (dailyLoss >= maxLoss) {
    await supabase
      .from('trading_bots')
      .update({ status: 'stopped_by_risk' })
      .eq('id', bot.id);

    let closeResult = null;
    if (bot.broker_credential_id) {
      const { data: cred } = await supabase
        .from('broker_credentials')
        .select('*')
        .eq('id', bot.broker_credential_id)
        .maybeSingle();
      if (cred) {
        try {
          const broker = AlpacaBroker.fromCredentials(cred);
          closeResult = await broker.closeAllPositions();
        } catch (err) {
          closeResult = { error: err.message };
        }
      }
    }

    await logExecution({
      userId: bot.user_id,
      botId: bot.id,
      modelId: bot.model_id,
      action: 'RISK_HALT',
      status: 'stopped_by_risk',
      message: `Daily loss limit ($${maxLoss}) exceeded. Bot halted and positions closed.`,
      brokerResponse: closeResult,
    });

    return true;
  }
  return false;
}

async function evaluateAndExecute(bot) {
  const { data: model } = await supabase
    .from('strategy_models')
    .select('*')
    .eq('id', bot.model_id)
    .maybeSingle();

  if (!model || model.status !== 'ready') return;

  const ruleset = typeof model.ruleset === 'string' ? JSON.parse(model.ruleset) : model.ruleset;
  if (!ruleset) return;

  const { data: cred } = await supabase
    .from('broker_credentials')
    .select('*')
    .eq('id', bot.broker_credential_id)
    .maybeSingle();

  if (!cred) {
    await logExecution({
      userId: bot.user_id,
      botId: bot.id,
      modelId: bot.model_id,
      action: 'SKIP',
      status: 'failed',
      message: 'No broker credentials configured',
    });
    return;
  }

  const broker = AlpacaBroker.fromCredentials(cred);
  const preferredSymbols = ruleset.entry_rules?.preferred_symbols || ['SPY'];

  for (const symbol of preferredSymbols.slice(0, 2)) {
    try {
      const price = await broker.getLatestPrice(symbol);
      if (!price) continue;

      const priceRange = ruleset.entry_rules?.price_range;
      if (priceRange && (price < priceRange.min || price > priceRange.max)) {
        await logExecution({
          userId: bot.user_id,
          botId: bot.id,
          modelId: bot.model_id,
          action: 'EVALUATE',
          symbol,
          price,
          status: 'skipped',
          message: `Price ${price} outside learned range [${priceRange.min}-${priceRange.max}]`,
        });
        continue;
      }

      const confidence = ruleset.risk_management?.confidence_threshold || 0.5;
      const winRate = (model.win_rate || 50) / 100;

      if (winRate >= confidence) {
        const qty = 1;
        const side = ruleset.behavioral_signature?.dominant_side === 'long' ? 'buy' : 'buy';

        const orderResult = await broker.placeOrder({ symbol, qty, side });

        await logExecution({
          userId: bot.user_id,
          botId: bot.id,
          modelId: bot.model_id,
          action: side.toUpperCase(),
          symbol,
          quantity: qty,
          price,
          status: 'success',
          message: `Order placed: ${side} ${qty} ${symbol} @ ~$${price.toFixed(2)}`,
          brokerResponse: orderResult,
        });

        const estimatedPnl = side === 'buy' ? -price * qty * 0.001 : price * qty * 0.001;
        await supabase
          .from('trading_bots')
          .update({ current_daily_pnl: (parseFloat(bot.current_daily_pnl) + estimatedPnl) })
          .eq('id', bot.id);
      }
    } catch (err) {
      await logExecution({
        userId: bot.user_id,
        botId: bot.id,
        modelId: bot.model_id,
        action: 'EXECUTE',
        symbol,
        status: 'failed',
        message: err.message,
      });
    }
  }
}

async function processActiveBots() {
  try {
    const { data: bots, error } = await supabase
      .from('trading_bots')
      .select('*, broker_credentials!inner(*)')
      .eq('status', 'active');

    if (error) {
      // Fallback: fetch bots and credentials separately
      const { data: botList } = await supabase
        .from('trading_bots')
        .select('*')
        .eq('status', 'active');

      if (botList && botList.length > 0) {
        for (const bot of botList) {
          const { data: cred } = await supabase
            .from('broker_credentials')
            .select('id')
            .eq('user_id', bot.user_id)
            .limit(1)
            .maybeSingle();

          const botWithCred = { ...bot, broker_credential_id: cred?.id || null };
          const halted = await checkRiskGuardrail(botWithCred);
          if (!halted) {
            await evaluateAndExecute(botWithCred);
          }
        }
      }
      return;
    }

    for (const bot of (bots || [])) {
      const halted = await checkRiskGuardrail(bot);
      if (!halted) {
        await evaluateAndExecute(bot);
      }
    }
  } catch (err) {
    console.error('Worker cycle error:', err);
  }
}

console.log(`Strat-Clone Execution Worker started (poll interval: ${POLL_INTERVAL_MS}ms)`);
processActiveBots();
setInterval(processActiveBots, POLL_INTERVAL_MS);

process.on('SIGINT', () => {
  console.log('Worker shutting down...');
  process.exit(0);
});
