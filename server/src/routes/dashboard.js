import { Router } from 'express';
import { query } from '../db.js';
import { authMiddleware } from '../middleware/auth.js';

const router = Router();

router.get('/summary', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;

    const [models, datasets, broker, bots, logs] = await Promise.all([
      query(`SELECT COUNT(*) FROM strategy_models WHERE user_id = $1 AND status = 'ready'`, [userId]),
      query(`SELECT COUNT(*) FROM trade_datasets WHERE user_id = $1`, [userId]),
      query(`SELECT connection_status, is_paper_trading FROM broker_credentials WHERE user_id = $1 AND is_active = true LIMIT 1`, [userId]),
      query(`SELECT COUNT(*) FROM trading_bots WHERE user_id = $1 AND status = 'active'`, [userId]),
      query(`SELECT COUNT(*) FROM execution_logs WHERE user_id = $1 AND created_at > NOW() - INTERVAL '24 hours'`, [userId]),
    ]);

    res.json({
      activeModels: parseInt(models.rows[0].count),
      totalDatasets: parseInt(datasets.rows[0].count),
      activeBots: parseInt(bots.rows[0].count),
      executionsToday: parseInt(logs.rows[0].count),
      broker: broker.rows[0] || { connection_status: 'disconnected', is_paper_trading: true },
    });
  } catch (err) {
    console.error('Dashboard summary error:', err);
    res.status(500).json({ error: 'Failed to fetch dashboard summary' });
  }
});

export default router;
