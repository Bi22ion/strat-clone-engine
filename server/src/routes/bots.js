import { Router } from 'express';
import { query } from '../db.js';
import { authMiddleware } from '../middleware/auth.js';
import { AlpacaBroker } from '../services/brokerService.js';

const router = Router();

router.get('/', authMiddleware, async (req, res) => {
  try {
    const result = await query(
      `SELECT tb.*, sm.name as model_name, sm.win_rate, sm.status as model_status
       FROM trading_bots tb
       JOIN strategy_models sm ON tb.model_id = sm.id
       WHERE tb.user_id = $1
       ORDER BY tb.created_at DESC`,
      [req.user.id]
    );
    res.json({ bots: result.rows });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch bots' });
  }
});

router.post('/', authMiddleware, async (req, res) => {
  try {
    const { modelId, name, maxDailyLoss = 1000 } = req.body;
    if (!modelId) {
      return res.status(400).json({ error: 'modelId is required' });
    }

    const model = await query(
      `SELECT * FROM strategy_models WHERE id = $1 AND user_id = $2 AND status = 'ready'`,
      [modelId, req.user.id]
    );
    if (model.rows.length === 0) {
      return res.status(400).json({ error: 'Ready model not found' });
    }

    const broker = await query(
      'SELECT id FROM broker_credentials WHERE user_id = $1 AND is_active = true LIMIT 1',
      [req.user.id]
    );

    const result = await query(
      `INSERT INTO trading_bots (user_id, model_id, broker_credential_id, name, max_daily_loss, status)
       VALUES ($1, $2, $3, $4, $5, 'inactive') RETURNING *`,
      [req.user.id, modelId, broker.rows[0]?.id || null, name || `Bot - ${model.rows[0].name}`, maxDailyLoss]
    );

    res.status(201).json({ bot: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: 'Failed to create bot' });
  }
});

router.patch('/:id/start', authMiddleware, async (req, res) => {
  try {
    const result = await query(
      `UPDATE trading_bots SET status = 'active' WHERE id = $1 AND user_id = $2 RETURNING *`,
      [req.params.id, req.user.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Bot not found' });
    }
    res.json({ bot: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: 'Failed to start bot' });
  }
});

router.patch('/:id/stop', authMiddleware, async (req, res) => {
  try {
    const result = await query(
      `UPDATE trading_bots SET status = 'inactive' WHERE id = $1 AND user_id = $2 RETURNING *`,
      [req.params.id, req.user.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Bot not found' });
    }
    res.json({ bot: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: 'Failed to stop bot' });
  }
});

router.patch('/:id/risk', authMiddleware, async (req, res) => {
  try {
    const { maxDailyLoss } = req.body;
    const result = await query(
      `UPDATE trading_bots SET max_daily_loss = $1 WHERE id = $2 AND user_id = $3 RETURNING *`,
      [maxDailyLoss, req.params.id, req.user.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Bot not found' });
    }
    res.json({ bot: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update risk settings' });
  }
});

router.post('/kill-switch', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;

    const activeBots = await query(
      `UPDATE trading_bots SET status = 'stopped_emergency' WHERE user_id = $1 AND status = 'active' RETURNING *`,
      [userId]
    );

    const credentials = await query(
      'SELECT * FROM broker_credentials WHERE user_id = $1 AND is_active = true LIMIT 1',
      [userId]
    );

    let closeResult = null;
    if (credentials.rows.length > 0) {
      try {
        const broker = AlpacaBroker.fromCredentials(credentials.rows[0]);
        closeResult = await broker.closeAllPositions();
      } catch (err) {
        closeResult = { error: err.message };
      }
    }

    await query(
      `INSERT INTO execution_logs (user_id, action, status, message, broker_response)
       VALUES ($1, 'EMERGENCY_KILL', 'executed', 'Emergency kill switch activated - all bots stopped', $2)`,
      [userId, JSON.stringify(closeResult)]
    );

    res.json({
      success: true,
      botsStopped: activeBots.rows.length,
      positionsClosed: closeResult,
    });
  } catch (err) {
    console.error('Kill switch error:', err);
    res.status(500).json({ error: 'Emergency kill switch failed' });
  }
});

router.get('/logs', authMiddleware, async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 50;
    const result = await query(
      `SELECT el.*, tb.name as bot_name
       FROM execution_logs el
       LEFT JOIN trading_bots tb ON el.bot_id = tb.id
       WHERE el.user_id = $1
       ORDER BY el.created_at DESC
       LIMIT $2`,
      [req.user.id, limit]
    );
    res.json({ logs: result.rows });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch execution logs' });
  }
});

export default router;
