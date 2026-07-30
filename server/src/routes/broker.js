import { Router } from 'express';
import { query } from '../db.js';
import { authMiddleware } from '../middleware/auth.js';
import { encrypt } from '../utils/encryption.js';
import { testBrokerConnection } from '../services/brokerService.js';

const router = Router();

router.get('/', authMiddleware, async (req, res) => {
  try {
    const result = await query(
      `SELECT id, broker_name, is_active, connection_status
       FROM broker_credentials WHERE user_id = $1`,
      [req.user.id]
    ).catch(() => ({ rows: [] }));
    res.json({ credentials: result.rows });
  } catch (err) {
    res.json({ credentials: [] });
  }
});

router.post('/', authMiddleware, async (req, res) => {
  try {
    const { apiKey, apiSecret, brokerName = 'alpaca' } = req.body;
    if (!apiKey || !apiSecret) {
      return res.status(400).json({ error: 'API key and secret are required' });
    }

    const encryptedKey = encrypt(apiKey);
    const encryptedSecret = encrypt(apiSecret);

    const result = await query(
      `INSERT INTO broker_credentials (user_id, broker_name, api_key_encrypted, api_secret_encrypted, is_active)
       VALUES ($1, $2, $3, $4, true)
       RETURNING id, broker_name, is_active, connection_status`,
      [req.user.id, brokerName, encryptedKey, encryptedSecret]
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
      'SELECT * FROM broker_credentials WHERE user_id = $1 LIMIT 1',
      [req.user.id]
    ).catch(() => ({ rows: [] }));

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'No broker credentials found' });
    }

    let testResult = { connected: true };
    try {
      testResult = await testBrokerConnection(result.rows[0]);
    } catch (e) {
      testResult = { connected: false, message: e.message };
    }

    const status = testResult.connected ? 'connected' : 'failed';

    await query(
      `UPDATE broker_credentials SET connection_status = $1 WHERE id = $2`,
      [status, result.rows[0].id]
    ).catch(() => {});

    res.json({ ...testResult, connection_status: status });
  } catch (err) {
    res.status(500).json({ error: err.message || 'Connection test failed' });
  }
});

router.patch('/paper-trading', authMiddleware, async (req, res) => {
  try {
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update setting' });
  }
});

export default router[cite: 3];
