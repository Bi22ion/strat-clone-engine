import { query } from '../db.js';
import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export async function trainModelNode(datasetId, userId, modelName) {
  const trades = await query(
    `SELECT * FROM parsed_trades WHERE dataset_id = $1 AND user_id = $2 ORDER BY timestamp`,
    [datasetId, userId]
  );

  if (trades.rows.length === 0) {
    throw new Error('No parsed trades found for this dataset');
  }

  const modelResult = await query(
    `INSERT INTO strategy_models (user_id, dataset_id, name, status)
     VALUES ($1, $2, $3, 'training') RETURNING *`,
    [userId, datasetId, modelName]
  );
  const model = modelResult.rows[0];

  try {
    const metrics = extractBehavioralPatterns(trades.rows);

    await query(
      `UPDATE strategy_models SET
        status = 'ready',
        win_rate = $1,
        avg_risk_reward = $2,
        avg_trade_duration_minutes = $3,
        preferred_asset_classes = $4,
        ruleset = $5,
        metrics = $6
       WHERE id = $7`,
      [
        metrics.winRate,
        metrics.avgRiskReward,
        metrics.avgTradeDurationMinutes,
        JSON.stringify(metrics.preferredAssetClasses),
        JSON.stringify(metrics.ruleset),
        JSON.stringify(metrics),
        model.id,
      ]
    );

    const updated = await query('SELECT * FROM strategy_models WHERE id = $1', [model.id]);
    return updated.rows[0];
  } catch (err) {
    await query(`UPDATE strategy_models SET status = 'failed' WHERE id = $1`, [model.id]);
    throw err;
  }
}

function extractBehavioralPatterns(trades) {
  const wins = trades.filter((t) => parseFloat(t.pnl) > 0);
  const losses = trades.filter((t) => parseFloat(t.pnl) <= 0);
  const winRate = trades.length > 0 ? (wins.length / trades.length) * 100 : 0;

  const avgWin = wins.length > 0
    ? wins.reduce((s, t) => s + Math.abs(parseFloat(t.pnl)), 0) / wins.length
    : 0;
  const avgLoss = losses.length > 0
    ? losses.reduce((s, t) => s + Math.abs(parseFloat(t.pnl)), 0) / losses.length
    : 1;
  const avgRiskReward = avgLoss > 0 ? avgWin / avgLoss : avgWin;

  const durations = trades.map((t) => t.duration_minutes || 0);
  const avgTradeDurationMinutes = durations.length > 0
    ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length)
    : 0;

  const assetClassCounts = {};
  trades.forEach((t) => {
    const cls = t.asset_class || 'equity';
    assetClassCounts[cls] = (assetClassCounts[cls] || 0) + 1;
  });
  const preferredAssetClasses = Object.entries(assetClassCounts)
    .sort((a, b) => b[1] - a[1])
    .map(([cls, count]) => ({ class: cls, count, percentage: (count / trades.length) * 100 }));

  const symbolCounts = {};
  trades.forEach((t) => {
    symbolCounts[t.symbol] = (symbolCounts[t.symbol] || 0) + 1;
  });
  const topSymbols = Object.entries(symbolCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([symbol, count]) => ({ symbol, count }));

  const avgEntryPrice = trades.reduce((s, t) => s + parseFloat(t.entry_price), 0) / trades.length;

  const ruleset = {
    version: '1.0',
    type: 'behavioral_clone',
    generated_at: new Date().toISOString(),
    entry_rules: {
      preferred_symbols: topSymbols.map((s) => s.symbol),
      preferred_asset_classes: preferredAssetClasses.map((a) => a.class),
      min_win_rate_threshold: Math.max(winRate - 10, 40),
      price_range: {
        min: avgEntryPrice * 0.5,
        max: avgEntryPrice * 2,
      },
    },
    exit_rules: {
      target_risk_reward: Math.max(avgRiskReward, 1.5),
      max_hold_minutes: avgTradeDurationMinutes * 2 || 480,
      stop_loss_multiplier: 1 / Math.max(avgRiskReward, 1),
    },
    risk_management: {
      max_position_size_pct: 5,
      max_daily_trades: Math.min(Math.ceil(trades.length / 30), 10),
      confidence_threshold: winRate / 100,
    },
    behavioral_signature: {
      win_rate: winRate,
      avg_risk_reward: avgRiskReward,
      trade_frequency: trades.length,
      dominant_side: trades.filter((t) => t.side === 'buy').length > trades.length / 2 ? 'long' : 'mixed',
    },
  };

  return {
    winRate: Math.round(winRate * 100) / 100,
    avgRiskReward: Math.round(avgRiskReward * 10000) / 10000,
    avgTradeDurationMinutes,
    preferredAssetClasses,
    topSymbols,
    totalTrades: trades.length,
    ruleset,
  };
}

export function trainModelPython(datasetId, userId, modelName) {
  return new Promise((resolve, reject) => {
    const scriptPath = path.join(__dirname, '../../../scripts/train_model.py');
    const proc = spawn('python', [scriptPath, datasetId, userId, modelName], {
      env: { ...process.env },
    });

    let stdout = '';
    let stderr = '';
    proc.stdout.on('data', (d) => { stdout += d; });
    proc.stderr.on('data', (d) => { stderr += d; });

    proc.on('close', (code) => {
      if (code === 0) {
        try {
          resolve(JSON.parse(stdout.trim()));
        } catch {
          resolve({ success: true, output: stdout });
        }
      } else {
        reject(new Error(stderr || `Python script exited with code ${code}`));
      }
    });
  });
}
