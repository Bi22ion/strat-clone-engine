import { decrypt } from '../utils/encryption.js';

const PAPER_BASE = process.env.ALPACA_PAPER_URL || 'https://paper-api.alpaca.markets';
const LIVE_BASE = 'https://api.alpaca.markets';

export class AlpacaBroker {
  constructor(apiKey, apiSecret, isPaper = true) {
    this.apiKey = apiKey;
    this.apiSecret = apiSecret;
    this.baseUrl = isPaper ? PAPER_BASE : LIVE_BASE;
  }

  static fromCredentials(credentials) {
    const apiKey = decrypt(credentials.api_key_encrypted);
    const apiSecret = decrypt(credentials.api_secret_encrypted);
    return new AlpacaBroker(apiKey, apiSecret, credentials.is_paper_trading);
  }

  async request(method, path, body = null) {
    const url = `${this.baseUrl}${path}`;
    const options = {
      method,
      headers: {
        'APCA-API-KEY-ID': this.apiKey,
        'APCA-API-SECRET-KEY': this.apiSecret,
        'Content-Type': 'application/json',
      },
    };
    if (body) options.body = JSON.stringify(body);

    const response = await fetch(url, options);
    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new Error(data.message || `Alpaca API error: ${response.status}`);
    }
    return data;
  }

  async testConnection() {
    const account = await this.request('GET', '/v2/account');
    return {
      connected: true,
      accountId: account.id,
      status: account.status,
      buyingPower: account.buying_power,
      equity: account.equity,
      paper: this.baseUrl.includes('paper'),
    };
  }

  async getLatestPrice(symbol) {
    const data = await this.request('GET', `/v2/stocks/${symbol}/quotes/latest`);
    const quote = data.quote;
    return quote ? (parseFloat(quote.ap) + parseFloat(quote.bp)) / 2 : null;
  }

  async placeOrder({ symbol, qty, side, type = 'market', time_in_force = 'day' }) {
    return this.request('POST', '/v2/orders', {
      symbol,
      qty: String(qty),
      side,
      type,
      time_in_force,
    });
  }

  async closeAllPositions() {
    return this.request('DELETE', '/v2/positions');
  }

  async getPositions() {
    return this.request('GET', '/v2/positions');
  }

  async getAccount() {
    return this.request('GET', '/v2/account');
  }
}

export async function testBrokerConnection(credentials) {
  try {
    const broker = AlpacaBroker.fromCredentials(credentials);
    return await broker.testConnection();
  } catch (err) {
    return { connected: false, error: err.message };
  }
}
