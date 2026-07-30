import { Router } from 'express';
import { query } from '../db.js';
import { authMiddleware } from '../middleware/auth.js';
import { encrypt } from '../utils/encryption.js';
import { testBrokerConnection } from '../services/brokerService.js';

const router = Router();

router.get('/', authMiddleware, async (req, res) => {
  try {
    const result = await query(
      `SELECT id, broker_name, is_paper_trading, is_active, connection_status, last_tested_at, created_at, updated_at
       FROM broker_credentials WHERE user_id = $1`,
      [req.user.id]
    );
    res.json({ credentials: result.rows });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch broker credentials' });
  }
});

router.post('/', authMiddleware, async (req, res) => {
  try {
    const { apiKey, apiSecret, brokerName = 'alpaca', isPaperTrading = true } = req.body;
    if (!apiKey || !apiSecret) {
      return res.status(400).json({ error: 'API key and secret are required' });
    }

    const encryptedKey = encrypt(apiKey);
    const encryptedSecret = encrypt(apiSecret);

    const result = await query(
      `INSERT INTO broker_credentials (user_id, broker_name, api_key_encrypted, api_secret_encrypted, is_paper_trading, is_active)
       VALUES ($1, $2, $3, $4, $5, true)
       ON CONFLICT (user_id, broker_name)
       DO UPDATE SET api_key_encrypted = $3, api_secret_encrypted = $4, is_paper_trading = $5, is_active = true, updated_at = NOW()
       RETURNING id, broker_name, is_paper_trading, is_active, connection_status, created_at`,
      [req.user.id, brokerName, encryptedKey, encryptedSecret, isPaperTrading]
    );

    res.status(201).json({ credentials: result.rows[0] });
  } catch (err) {
    console.error('Broker save error:', err);
    res.status(500).json({ error: err.message || 'Failed to save credentials' });
  }
});

router.post('/test', authMiddleware, async (req, res) => {
  try {
    const result = await query(
      'SELECT * FROM broker_credentials WHERE user_id = $1 AND is_active = true LIMIT 1',
      [req.user.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'No active broker credentials found' });
    }

    const testResult = await testBrokerConnection(result.rows[0]);
    const status = testResult.connected ? 'connected' : 'failed';

    await query(
      `UPDATE broker_credentials SET connection_status = $1, last_tested_at = NOW() WHERE id = $2`,
      [status, result.rows[0].id]
    );

    res.json({ ...testResult, connection_status: status });
  } catch (err) {
    res.status(500).json({ error: err.message || 'Connection test failed' });
  }
});

router.patch('/paper-trading', authMiddleware, async (req, res) => {
  try {
    const { isPaperTrading } = req.body;
    const result = await query(
      `UPDATE broker_credentials SET is_paper_trading = $1 WHERE user_id = $2 AND is_active = true
       RETURNING id, is_paper_trading`,
      [isPaperTrading, req.user.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'No active credentials found' });
    }
    res.json({ credentials: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update paper trading setting' });
  }
});

export default router;
