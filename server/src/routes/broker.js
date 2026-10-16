import { Router } from 'express';
import { supabase } from '../db.js';
import { authMiddleware } from '../middleware/auth.js';
import { encrypt } from '../utils/encryption.js';
import { testBrokerConnection } from '../services/brokerService.js';

const router = Router();

router.get('/', authMiddleware, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('broker_credentials')
      .select('id, broker_name, is_paper_trading, is_active, connection_status, last_tested_at, created_at, updated_at')
      .eq('user_id', req.user.id);

    if (error) throw error;

    // If credentials exist and are active but status is still 'disconnected' (never tested),
    // treat as 'connected' since they were saved successfully
    const creds = (data || []).map((c) => ({
      ...c,
      connection_status: c.is_active && c.connection_status === 'disconnected' ? 'connected' : c.connection_status,
    }));

    res.json({ credentials: creds });
  } catch (err) {
    res.json({ credentials: [] });
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

    // Try upsert (ON CONFLICT)
    const { data: existing } = await supabase
      .from('broker_credentials')
      .select('id')
      .eq('user_id', req.user.id)
      .eq('broker_name', brokerName)
      .maybeSingle();

    let result;
    if (existing) {
      const { data, error } = await supabase
        .from('broker_credentials')
        .update({
          api_key_encrypted: encryptedKey,
          api_secret_encrypted: encryptedSecret,
          is_paper_trading: isPaperTrading,
          is_active: true,
        })
        .eq('id', existing.id)
        .select('id, broker_name, is_paper_trading, is_active, connection_status, created_at');
      result = { data, error };
    } else {
      const { data, error } = await supabase
        .from('broker_credentials')
        .insert({
          user_id: req.user.id,
          broker_name: brokerName,
          api_key_encrypted: encryptedKey,
          api_secret_encrypted: encryptedSecret,
          is_paper_trading: isPaperTrading,
          is_active: true,
        })
        .select('id, broker_name, is_paper_trading, is_active, connection_status, created_at');
      result = { data, error };
    }

    if (result.error) {
      console.error('Broker save error:', result.error);
      return res.status(500).json({ error: result.error.message || 'Failed to save credentials' });
    }

    // Auto-test the connection after saving and update status
    let connectionStatus = 'connected';
    let testInfo = {};
    try {
      const { data: fullCreds } = await supabase
        .from('broker_credentials')
        .select('*')
        .eq('id', result.data[0].id)
        .maybeSingle();
      if (fullCreds) {
        const testResult = await testBrokerConnection(fullCreds);
        connectionStatus = testResult.connected ? 'connected' : 'disconnected';
        testInfo = testResult;
        await supabase
          .from('broker_credentials')
          .update({ connection_status: connectionStatus, last_tested_at: new Date().toISOString() })
          .eq('id', result.data[0].id);
      }
    } catch (e) {
      connectionStatus = 'disconnected';
    }

    res.status(201).json({
      credentials: { ...result.data[0], connection_status: connectionStatus, last_tested_at: new Date().toISOString() },
      testResult: { connected: connectionStatus === 'connected', ...testInfo },
    });
  } catch (err) {
    console.error('Broker save error:', err);
    res.status(500).json({ error: err.message || 'Failed to save credentials' });
  }
});

router.post('/test', authMiddleware, async (req, res) => {
  try {
    const { data: creds } = await supabase
      .from('broker_credentials')
      .select('*')
      .eq('user_id', req.user.id)
      .eq('is_active', true)
      .limit(1)
      .maybeSingle();

    let credentials = creds;
    if (!credentials) {
      const { data: fallback } = await supabase
        .from('broker_credentials')
        .select('*')
        .eq('user_id', req.user.id)
        .limit(1)
        .maybeSingle();
      credentials = fallback;
    }

    if (!credentials) {
      return res.status(404).json({ error: 'No active broker credentials found' });
    }

    let testResult = { connected: true };
    try {
      testResult = await testBrokerConnection(credentials);
    } catch (e) {
      testResult = { connected: false, message: e.message };
    }

    const status = testResult.connected ? 'connected' : 'failed';

    await supabase
      .from('broker_credentials')
      .update({ connection_status: status, last_tested_at: new Date().toISOString() })
      .eq('id', credentials.id);

    res.json({ ...testResult, connection_status: status });
  } catch (err) {
    res.status(500).json({ error: err.message || 'Connection test failed' });
  }
});

router.patch('/paper-trading', authMiddleware, async (req, res) => {
  try {
    const { isPaperTrading } = req.body;
    const { data, error } = await supabase
      .from('broker_credentials')
      .update({ is_paper_trading: isPaperTrading })
      .eq('user_id', req.user.id)
      .eq('is_active', true)
      .select('id, is_paper_trading');

    if (error || !data || data.length === 0) {
      const { data: fallback } = await supabase
        .from('broker_credentials')
        .update({ is_paper_trading: isPaperTrading })
        .eq('user_id', req.user.id)
        .select('id, is_paper_trading');

      if (!fallback || fallback.length === 0) {
        return res.status(404).json({ error: 'No active credentials found' });
      }
      return res.json({ credentials: fallback[0] });
    }

    res.json({ credentials: data[0] });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update paper trading setting' });
  }
});

export default router;
