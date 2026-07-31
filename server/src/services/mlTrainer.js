import { supabase } from '../db.js';

export async function trainModelNode(datasetId, userId, modelName) {
  const { data: trades, error } = await supabase
    .from('parsed_trades')
    .select('*')
    .eq('dataset_id', datasetId)
    .eq('user_id', userId)
    .order('timestamp', { ascending: true });

  if (error) throw error;
  if (!trades || trades.length === 0) {
    throw new Error('No parsed trades found for this dataset');
  }

  const { data: model, error: modelError } = await supabase
    .from('strategy_models')
    .insert({
      user_id: userId,
      dataset_id: datasetId,
      name: modelName,
      status: 'training',
    })
    .select('*')
    .single();

  if (modelError) throw modelError;

  try {
    const metrics = extractBehavioralPatterns(trades);

    const { error: updateError } = await supabase
      .from('strategy_models')
      .update({
        status: 'ready',
        win_rate: metrics.winRate,
        avg_risk_reward: metrics.avgRiskReward,
        avg_trade_duration_minutes: metrics.avgTradeDurationMinutes,
        preferred_asset_classes: JSON.stringify(metrics.preferredAssetClasses),
        ruleset: JSON.stringify(metrics.ruleset),
        metrics: JSON.stringify(metrics),
      })
      .eq('id', model.id);

    if (updateError) throw updateError;

    const { data: updated } = await supabase
      .from('strategy_models')
      .select('*')
      .eq('id', model.id)
      .single();

    return updated;
  } catch (err) {
    await supabase.from('strategy_models').update({ status: 'failed' }).eq('id', model.id);
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
