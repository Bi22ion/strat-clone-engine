import { Router } from 'express';
import { query } from '../db.js';
import { authMiddleware } from '../middleware/auth.js';

const router = Router();

router.get('/summary', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;

    const [models, datasets, broker, bots, logs] = await Promise.all([
      query(`SELECT COUNT(*) FROM strategy_models WHERE user_id = $1 AND status = 'ready'`, [userId]).catch(() => ({ rows: [{ count: '0' }] })),
      query(`SELECT COUNT(*) FROM trade_datasets WHERE user_id = $1`, [userId]).catch(() => ({ rows: [{ count: '0' }] })),
      query(`SELECT connection_status FROM broker_credentials WHERE user_id = $1 LIMIT 1`, [userId]).catch(() => ({ rows: [] })),
      query(`SELECT COUNT(*) FROM trading_bots WHERE user_id = $1 AND status = 'active'`, [userId]).catch(() => ({ rows: [{ count: '0' }] })),
      query(`SELECT COUNT(*) FROM execution_logs WHERE user_id = $1`, [userId]).catch(() => ({ rows: [{ count: '0' }] })),
    ]);

    res.json({
      activeModels: parseInt(models.rows[0]?.count || '0', 10),
      totalDatasets: parseInt(datasets.rows[0]?.count || '0', 10),
      activeBots: parseInt(bots.rows[0]?.count || '0', 10),
      executionsToday: parseInt(logs.rows[0]?.count || '0', 10),
      broker: {
        connection_status: broker.rows[0]?.connection_status || 'disconnected',
        is_paper_trading: true,
      },
    });
  } catch (err) {
    console.error('Dashboard summary error:', err);
    res.status(500).json({ error: 'Failed to fetch dashboard summary' });
  }
});

export default router;
