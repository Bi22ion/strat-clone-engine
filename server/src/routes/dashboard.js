import { Router } from 'express';
import { supabase } from '../db.js';
import { authMiddleware } from '../middleware/auth.js';

const router = Router();

router.get('/summary', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;

    const [modelsRes, datasetsRes, brokerRes, botsRes, logsRes] = await Promise.all([
      supabase.from('strategy_models').select('id', { count: 'exact', head: true }).eq('user_id', userId).eq('status', 'ready'),
      supabase.from('trade_datasets').select('id', { count: 'exact', head: true }).eq('user_id', userId),
      supabase.from('broker_credentials').select('connection_status').eq('user_id', userId).limit(1),
      supabase.from('trading_bots').select('id', { count: 'exact', head: true }).eq('user_id', userId).eq('status', 'active'),
      supabase.from('execution_logs').select('id', { count: 'exact', head: true }).eq('user_id', userId),
    ]);

    res.json({
      activeModels: modelsRes.count || 0,
      totalDatasets: datasetsRes.count || 0,
      activeBots: botsRes.count || 0,
      executionsToday: logsRes.count || 0,
      broker: {
        connection_status: brokerRes.data?.[0]?.connection_status || 'disconnected',
        is_paper_trading: true,
      },
    });
  } catch (err) {
    console.error('Dashboard summary error:', err);
    res.status(500).json({ error: 'Failed to fetch dashboard summary' });
  }
});

// Live stocks / projected trades — simulated tickers from user's trade history + popular stocks
router.get('/live-stocks', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;

    // Get user's most-traded symbols from parsed trades
    const { data: trades } = await supabase
      .from('parsed_trades')
      .select('symbol, entry_price, exit_price, pnl, side, asset_class')
      .eq('user_id', userId)
      .limit(200);

    const symbolStats = {};
    (trades || []).forEach((t) => {
      const sym = t.symbol;
      if (!symbolStats[sym]) {
        symbolStats[sym] = { symbol: sym, count: 0, wins: 0, totalPnl: 0, lastPrice: parseFloat(t.entry_price) };
      }
      symbolStats[sym].count++;
      if (parseFloat(t.pnl) > 0) symbolStats[sym].wins++;
      symbolStats[sym].totalPnl += parseFloat(t.pnl || 0);
      symbolStats[sym].lastPrice = parseFloat(t.exit_price || t.entry_price);
    });

    const userStocks = Object.values(symbolStats)
      .sort((a, b) => b.count - a.count)
      .slice(0, 4);

    // Default popular stocks if user has no trade history
    const defaultStocks = [
      { symbol: 'AAPL', lastPrice: 232.50, count: 0, wins: 0, totalPnl: 0 },
      { symbol: 'TSLA', lastPrice: 248.30, count: 0, wins: 0, totalPnl: 0 },
      { symbol: 'BTC/USD', lastPrice: 67500, count: 0, wins: 0, totalPnl: 0 },
      { symbol: 'NVDA', lastPrice: 138.72, count: 0, wins: 0, totalPnl: 0 },
    ];

    const stocks = userStocks.length > 0 ? userStocks : defaultStocks;

    // Generate simulated live tickers with small random walk
    const liveStocks = stocks.map((s) => {
      const basePrice = s.lastPrice || 100;
      const change = (Math.random() - 0.48) * basePrice * 0.02;
      const currentPrice = Math.max(basePrice + change, 0.01);
      const changePct = (change / basePrice) * 100;
      const winRate = s.count > 0 ? (s.wins / s.count) * 100 : 0;
      return {
        symbol: s.symbol,
        price: Math.round(currentPrice * 100) / 100,
        change: Math.round(change * 100) / 100,
        changePct: Math.round(changePct * 100) / 100,
        isUp: change >= 0,
        tradeCount: s.count,
        winRate: Math.round(winRate * 10) / 10,
        totalPnl: Math.round(s.totalPnl * 100) / 100,
      };
    });

    // Generate projected trades based on user's models
    const { data: models } = await supabase
      .from('strategy_models')
      .select('id, name, win_rate, avg_risk_reward, ruleset')
      .eq('user_id', userId)
      .eq('status', 'ready')
      .limit(3);

    const projectedTrades = [];
    for (const model of (models || [])) {
      const ruleset = typeof model.ruleset === 'string' ? JSON.parse(model.ruleset || '{}') : model.ruleset || {};
      const preferredSymbols = ruleset.entry_rules?.preferred_symbols || stocks.map((s) => s.symbol);
      const targetRR = ruleset.exit_rules?.target_risk_reward || 2.0;
      const confidence = ruleset.risk_management?.confidence_threshold || 0.6;

      for (const sym of preferredSymbols.slice(0, 2)) {
        const stock = liveStocks.find((s) => s.symbol === sym) || liveStocks[0];
        if (!stock) continue;
        const entryPrice = stock.price;
        const stopLoss = Math.round(entryPrice * (1 - 1 / Math.max(targetRR, 1)) * 100) / 100;
        const takeProfit = Math.round(entryPrice * (1 + targetRR / 100 * entryPrice / entryPrice) * 100) / 100;
        const tp = Math.round(entryPrice * (1 + (targetRR * 0.01)) * 100) / 100;
        const sl = Math.round(entryPrice * (1 - (1 / targetRR) * 0.01) * 100) / 100;

        projectedTrades.push({
          model: model.name,
          modelId: model.id,
          symbol: sym,
          side: 'BUY',
          entryPrice,
          takeProfit: tp,
          stopLoss: sl,
          confidence: Math.round(confidence * 100),
          winRate: model.win_rate || 0,
          riskReward: targetRR,
          signal: confidence > 0.7 ? 'STRONG_BUY' : 'BUY',
        });
      }
    }

    // If no models, generate demo projected trades
    if (projectedTrades.length === 0) {
      for (const stock of liveStocks.slice(0, 3)) {
        const entryPrice = stock.price;
        projectedTrades.push({
          model: 'Demo Strategy',
          modelId: null,
          symbol: stock.symbol,
          side: 'BUY',
          entryPrice,
          takeProfit: Math.round(entryPrice * 1.02 * 100) / 100,
          stopLoss: Math.round(entryPrice * 0.99 * 100) / 100,
          confidence: 65,
          winRate: 70,
          riskReward: 2.0,
          signal: 'BUY',
        });
      }
    }

    res.json({ liveStocks, projectedTrades });
  } catch (err) {
    console.error('Live stocks error:', err);
    res.status(500).json({ error: 'Failed to load live stocks' });
  }
});

export default router;
