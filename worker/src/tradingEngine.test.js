import test from 'node:test';
import assert from 'node:assert/strict';
import { approveRisk, createInMemoryRepository, createPaperBroker, emergencyStop, evaluateSignal, normalizeOrderResult, runOneEvaluation } from './tradingEngine.js';

const model = { status: 'ready', win_rate: 70, ruleset: { version: 'test-1', entry_rules: { preferred_symbols: ['SPY'], price_range: { min: 90, max: 110 } }, risk_management: { confidence_threshold: 0.6 } } };
const bot = { id: 'bot-1', user_id: 'user-1', model_id: 'model-1', status: 'active', current_daily_pnl: 0, max_daily_loss: 1000, max_open_positions: 5 };

test('valid paper signal reaches order, fill, and persistence', async () => {
  const repository = createInMemoryRepository();
  const result = await runOneEvaluation({ bot, model, broker: createPaperBroker({ price: 100 }), repository });
  assert.equal(result.result.accepted, true); assert.equal(result.fill.state, 'filled');
  assert.equal(repository.decisions.length, 1); assert.equal(repository.orders.length, 1); assert.equal(repository.fills.length, 1);
});
test('stale or missing quote fails closed', () => {
  assert.equal(evaluateSignal({ model, quote: null }).action, 'NO_TRADE');
  assert.equal(evaluateSignal({ model, quote: { symbol: 'SPY', price: 100, timestamp: '2020-01-01T00:00:00Z' } }).reason, 'stale_quote');
});
test('risk blocks missing account and daily loss', () => {
  assert.equal(approveRisk({ decision: { action: 'BUY', quantity: 1, referencePrice: 100, dataTimestamp: new Date().toISOString() }, account: null, bot }).approved, false);
  assert.equal(approveRisk({ decision: { action: 'BUY', quantity: 1, referencePrice: 100, dataTimestamp: new Date().toISOString() }, account: { equity: 100000 }, bot: { ...bot, current_daily_pnl: -1000 } }).reason, 'daily_loss_limit');
});
test('broker response without an id is not success', () => assert.equal(normalizeOrderResult({ status: 'accepted' }).accepted, false));
test('paper broker credentials are actively tested before evaluation', async () => {
  let tested = false;
  const broker = createPaperBroker();
  const original = broker.testConnection;
  broker.testConnection = async () => { tested = true; return original(); };
  await runOneEvaluation({ bot, model, broker, repository: createInMemoryRepository() });
  assert.equal(tested, true);
});
test('stopped bot cannot submit an order', async () => {
  const repository = createInMemoryRepository();
  const result = await runOneEvaluation({ bot: { ...bot, status: 'inactive' }, model, broker: createPaperBroker(), repository });
  assert.equal(result.reason, 'bot_not_active'); assert.equal(repository.orders.length, 0);
});
test('emergency stop stops bots and handles orders and positions', async () => {
  const repository = createInMemoryRepository();
  const result = await emergencyStop({ bots: [bot, { ...bot, id: 'bot-2', status: 'inactive' }], broker: createPaperBroker(), repository });
  assert.equal(result.stopped, 1); assert.equal(result.ok, true); assert.deepEqual(repository.stopped, ['bot-1']);
});

test('duplicate client order is not submitted twice', async () => {
  const repository = createInMemoryRepository();
  const broker = createPaperBroker({ price: 100 });
  const first = await runOneEvaluation({ bot, model, broker, repository });
  repository.findOrderByClientOrderId = async (id) => repository.orders.some((order) => order.clientOrderId === id);
  const second = await runOneEvaluation({ bot, model, broker, repository });
  assert.equal(first.result.accepted, true);
  assert.equal(second.reason, 'duplicate_order_prevented');
  assert.equal(repository.orders.length, 1);
});

test('emergency stop reports broker failures instead of false success', async () => {
  const repository = createInMemoryRepository();
  const broker = { async cancelAllOrders() { throw new Error('broker unavailable'); }, async closeAllPositions() { return []; } };
  const result = await emergencyStop({ bots: [bot], broker, repository });
  assert.equal(result.ok, false);
  assert.equal(result.failures[0].action, 'cancel_orders');
});
