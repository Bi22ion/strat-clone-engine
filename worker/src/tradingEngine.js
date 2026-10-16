export function evaluateSignal({ model, quote, now = new Date(), maxQuoteAgeMs = 120000 }) {
  if (!quote || !Number.isFinite(Number(quote.price)) || Number(quote.price) <= 0) return { action: 'NO_TRADE', reason: 'missing_or_invalid_quote' };
  const age = now.getTime() - new Date(quote.timestamp).getTime();
  if (!Number.isFinite(age) || age > maxQuoteAgeMs || age < -5000) return { action: 'NO_TRADE', reason: 'stale_quote' };
  if (!model || model.status !== 'ready') return { action: 'NO_TRADE', reason: 'model_not_ready' };
  const rules = typeof model.ruleset === 'string' ? JSON.parse(model.ruleset) : model.ruleset;
  const symbols = rules?.entry_rules?.preferred_symbols || [];
  if (!symbols.includes(quote.symbol)) return { action: 'NO_TRADE', reason: 'symbol_not_eligible' };
  const range = rules?.entry_rules?.price_range;
  if (range && (quote.price < Number(range.min) || quote.price > Number(range.max))) return { action: 'NO_TRADE', reason: 'price_outside_model_range' };
  const threshold = Number(rules?.risk_management?.confidence_threshold);
  const winRate = Number(model.win_rate) / 100;
  if (!Number.isFinite(threshold) || !Number.isFinite(winRate) || winRate < threshold) return { action: 'NO_TRADE', reason: 'insufficient_model_confidence' };
  return { action: 'BUY', symbol: quote.symbol, quantity: 1, referencePrice: Number(quote.price), dataTimestamp: quote.timestamp, strategyVersion: rules.version || 'unknown' };
}

export function approveRisk({ decision, account, positions = [], bot, now = new Date(), maxQuoteAgeMs = 120000 }) {
  if (decision.action === 'NO_TRADE') return { approved: false, reason: decision.reason };
  if (!account || !Number.isFinite(Number(account.equity))) return { approved: false, reason: 'account_state_unavailable' };
  if (bot?.kill_switch || bot?.status !== 'active') return { approved: false, reason: 'bot_not_active' };
  if (Math.abs(Math.min(Number(bot.current_daily_pnl || 0), 0)) >= Number(bot.max_daily_loss)) return { approved: false, reason: 'daily_loss_limit' };
  if (new Date(decision.dataTimestamp).getTime() < now.getTime() - maxQuoteAgeMs) return { approved: false, reason: 'stale_quote' };
  if (positions.length >= Number(bot.max_open_positions || 5)) return { approved: false, reason: 'max_open_positions' };
  const notional = Number(decision.quantity) * Number(decision.referencePrice);
  if (!Number.isFinite(notional) || notional <= 0 || notional > Number(account.equity) * 0.05) return { approved: false, reason: 'position_limit' };
  return { approved: true, notional };
}

export function normalizeOrderResult(result) {
  if (!result?.id) return { accepted: false, reason: 'broker_did_not_return_order_id', raw: result };
  return { accepted: true, brokerOrderId: result.id, status: result.status || 'accepted', raw: result };
}

export function shouldCreateOrder({ bot, decision, risk, pendingOrderKeys }) {
  if (!risk.approved || decision.action === 'NO_TRADE') return false;
  const key = `${bot.id}:${decision.symbol}:${decision.action}:${decision.dataTimestamp}`;
  if (pendingOrderKeys.has(key)) return false;
  pendingOrderKeys.add(key);
  return true;
}

export function reconcileFill(order, brokerOrder) {
  const status = brokerOrder?.status;
  if (!['filled', 'partially_filled', 'canceled', 'rejected', 'expired'].includes(status)) return { state: 'pending' };
  return { state: status, filledQuantity: Number(brokerOrder.filled_qty || 0), averagePrice: Number(brokerOrder.filled_avg_price || 0) || null };
}

export function createPaperBroker({ price = 100 } = {}) {
  let sequence = 0;
  const orders = new Map();
  return {
    async testConnection() { return { connected: true, paper: true, accountId: 'paper-test' }; },
    async getAccount() { return { id: 'paper-test', equity: '100000', buying_power: '100000', status: 'ACTIVE' }; },
    async getLatestQuote(symbol) { return { symbol, price, timestamp: new Date().toISOString(), source: 'paper-fixture' }; },
    async placeOrder({ symbol, qty, side, clientOrderId }) {
      const id = `paper-${++sequence}`;
      const order = { id, client_order_id: clientOrderId, symbol, qty: String(qty), side, status: 'filled', filled_qty: String(qty), filled_avg_price: String(price) };
      orders.set(id, order);
      return order;
    },
    async getOrder(id) { return orders.get(id); },
    async getPositions() { return []; },
    async cancelAllOrders() { return []; },
    async closeAllPositions() { return []; },
  };
}

export async function runOneEvaluation({ bot, model, broker, repository, now = new Date() }) {
  if (bot.status !== 'active') return { action: 'NO_TRADE', reason: 'bot_not_active' };
  const connection = await broker.testConnection();
  if (!connection?.connected || !connection.paper) return { action: 'NO_TRADE', reason: 'paper_connection_required' };
  const account = await broker.getAccount();
  const symbols = (typeof model.ruleset === 'string' ? JSON.parse(model.ruleset) : model.ruleset)?.entry_rules?.preferred_symbols || [];
  for (const symbol of symbols) {
    const quote = await broker.getLatestQuote(symbol);
    const decision = evaluateSignal({ model, quote, now });
    const positions = await broker.getPositions();
    const risk = approveRisk({ decision, account, positions, bot, now });
    await repository.logDecision({ bot, decision, risk });
    if (!risk.approved) continue;
    const clientOrderId = `strat-${bot.id}-${symbol}-${quote.timestamp}`;
    if (repository.findOrderByClientOrderId && await repository.findOrderByClientOrderId(clientOrderId)) {
      return { action: 'NO_TRADE', reason: 'duplicate_order_prevented', clientOrderId };
    }
    const result = normalizeOrderResult(await broker.placeOrder({ symbol, qty: decision.quantity, side: 'buy', clientOrderId }));
    if (bot.status !== 'active' || bot.kill_switch) return { action: 'NO_TRADE', reason: 'bot_stopped_before_persistence' };
    await repository.persistOrder({ bot, decision, result, clientOrderId });
    if (!result.accepted) return result;
    const fill = reconcileFill(result, result.raw);
    await repository.persistFill({ bot, result, fill });
    return { decision, risk, result, fill };
  }
  return { action: 'NO_TRADE', reason: 'no_eligible_signal' };
}

export async function emergencyStop({ bots, broker, repository, closePositions = true }) {
  const active = bots.filter((bot) => bot.status === 'active' && !bot.kill_switch);
  const botIds = active.map((bot) => bot.id);
  await repository.stopBots(botIds);
  let canceled = null;
  let closed = null;
  const failures = [];
  try { canceled = await broker.cancelAllOrders(); } catch (error) { failures.push({ action: 'cancel_orders', error: error.message }); }
  if (closePositions) {
    try { closed = await broker.closeAllPositions(); } catch (error) { failures.push({ action: 'close_positions', error: error.message }); }
  }
  const result = { botIds, canceled, closed, failures, ok: failures.length === 0 };
  await repository.logEmergency(result);
  return { stopped: botIds.length, ...result };
}

export function createInMemoryRepository() {
  return {
    decisions: [], orders: [], fills: [], emergency: [],
    async logDecision(v) { this.decisions.push(v); },
    async persistOrder(v) { this.orders.push(v); },
    async persistFill(v) { this.fills.push(v); },
    async findOrderByClientOrderId(id) { return this.orders.find((order) => order.clientOrderId === id) || null; },
    async stopBots(ids) { this.stopped = ids; },
    async logEmergency(v) { this.emergency.push(v); },
  };
}
export const __private__ = { evaluateSignal, approveRisk, normalizeOrderResult, reconcileFill };
