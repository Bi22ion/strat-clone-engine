export function evaluateOnUnseenData(trades, transactionCostBps = 10) {
  const split = Math.max(1, Math.floor(trades.length * 0.7));
  const training = trades.slice(0, split);
  const unseen = trades.slice(split);
  const grossPnl = unseen.reduce((sum, trade) => sum + Number(trade.pnl || 0), 0);
  const costs = unseen.reduce((sum, trade) => sum + Math.abs(Number(trade.entry_price || 0)) * transactionCostBps / 10000, 0);
  const netPnl = grossPnl - costs;
  const wins = unseen.filter((trade) => Number(trade.pnl || 0) - Math.abs(Number(trade.entry_price || 0)) * transactionCostBps / 10000 > 0).length;
  const testWinRate = unseen.length ? wins / unseen.length * 100 : 0;
  return { winRate: Math.round(testWinRate * 100) / 100, metrics: { trainTrades: training.length, testTrades: unseen.length, grossPnl, transactionCosts: costs, netPnl, testWinRate, evaluation: unseen.length ? 'chronological_holdout' : 'insufficient_data_holdout' } };
}
