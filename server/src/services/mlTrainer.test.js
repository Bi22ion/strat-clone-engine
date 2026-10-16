import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluateOnUnseenData } from './modelMetrics.js';

test('model metrics are computed on chronological unseen data with costs', () => {
  const trades = Array.from({ length: 10 }, (_, index) => ({ pnl: index < 7 ? 10 : -1, entry_price: 100, duration_minutes: 5, symbol: 'SPY', asset_class: 'equity', side: 'buy' }));
  const metrics = evaluateOnUnseenData(trades);
  assert.equal(metrics.metrics.evaluation, 'chronological_holdout');
  assert.equal(metrics.metrics.trainTrades, 7);
  assert.equal(metrics.metrics.testTrades, 3);
  assert.ok(Math.abs(metrics.metrics.transactionCosts - 0.3) < 1e-9);
  assert.equal(metrics.metrics.netPnl, -3.3);
  assert.notEqual(metrics.winRate, 70);
});
