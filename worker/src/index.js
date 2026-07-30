import pg from 'pg';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { AlpacaBroker } from '../../server/src/services/brokerService.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '../../.env') });

const { Pool } = pg;
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

const POLL_INTERVAL_MS = parseInt(process.env.WORKER_POLL_INTERVAL) || 30000;

async function query(text, params) {
  return pool.query(text, params);
}

async function logExecution({ userId, botId, modelId, action, symbol, quantity, price, status, message, brokerResponse }) {
  await query(
    `INSERT INTO execution_logs (user_id, bot_id, model_id, action, symbol, quantity, price, status, message, broker_response)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
    [userId, botId, modelId, action, symbol, quantity, price, status, message, JSON.stringify(brokerResponse)]
  );
}

async function resetDailyPnLIfNeeded(bot) {
  const today = new Date().toISOString().split('T')[0];
  if (bot.risk_reset_at !== today) {
    await query(
      `UPDATE trading_bots SET current_daily_pnl = 0, risk_reset_at = $1 WHERE id = $2`,
      [today, bot.id]
    );
    bot.current_daily_pnl = 0;
    bot.risk_reset_at = today;
  }
}

async function checkRiskGuardrail(bot) {
  await resetDailyPnLIfNeeded(bot);
  const dailyLoss = Math.abs(Math.min(parseFloat(bot.current_daily_pnl), 0));
  const maxLoss = parseFloat(bot.max_daily_loss);

  if (dailyLoss >= maxLoss) {
    await query(
      `UPDATE trading_bots SET status = 'stopped_by_risk' WHERE id = $1`,
      [bot.id]
    );

    let closeResult = null;
    if (bot.broker_credential_id) {
      const credResult = await query('SELECT * FROM broker_credentials WHERE id = $1', [bot.broker_credential_id]);
      if (credResult.rows.length > 0) {
        try {
          const broker = AlpacaBroker.fromCredentials(credResult.rows[0]);
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
  const modelResult = await query('SELECT * FROM strategy_models WHERE id = $1', [bot.model_id]);
  if (modelResult.rows.length === 0 || modelResult.rows[0].status !== 'ready') return;

  const model = modelResult.rows[0];
  const ruleset = typeof model.ruleset === 'string' ? JSON.parse(model.ruleset) : model.ruleset;
  if (!ruleset) return;

  const credResult = await query('SELECT * FROM broker_credentials WHERE id = $1', [bot.broker_credential_id]);
  if (credResult.rows.length === 0) {
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

  const broker = AlpacaBroker.fromCredentials(credResult.rows[0]);
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
        await query(
          `UPDATE trading_bots SET current_daily_pnl = current_daily_pnl + $1 WHERE id = $2`,
          [estimatedPnl, bot.id]
        );
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
    const result = await query(
      `SELECT tb.*, bc.id as broker_credential_id
       FROM trading_bots tb
       LEFT JOIN broker_credentials bc ON tb.broker_credential_id = bc.id
       WHERE tb.status = 'active'`
    );

    for (const bot of result.rows) {
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

process.on('SIGINT', async () => {
  console.log('Worker shutting down...');
  await pool.end();
  process.exit(0);
});
