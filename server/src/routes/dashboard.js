import { Router } from 'express';
import { supabase } from '../db.js';
import { authMiddleware } from '../middleware/auth.js';

const router = Router();

router.get('/summary', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;

    const [modelsRes, datasetsRes, brokerRes, botsRes, logsRes] = await Promise.all([
      supabase.from('strategy_models').select('id', { count: 'exact', head: true }).eq('user_id', userId).eq('status', 'ready'),
      supabase.from('trade_datasets').select('id', { count: 'exact', head: true }).eq('user_id', userId),
      supabase.from('broker_credentials').select('connection_status').eq('user_id', userId).limit(1),
      supabase.from('trading_bots').select('id', { count: 'exact', head: true }).eq('user_id', userId).eq('status', 'active'),
      supabase.from('execution_logs').select('id', { count: 'exact', head: true }).eq('user_id', userId),
    ]);

    res.json({
      activeModels: modelsRes.count || 0,
      totalDatasets: datasetsRes.count || 0,
      activeBots: botsRes.count || 0,
      executionsToday: logsRes.count || 0,
      broker: {
        connection_status: brokerRes.data?.[0]?.connection_status || 'disconnected',
        is_paper_trading: true,
      },
    });
  } catch (err) {
    console.error('Dashboard summary error:', err);
    res.status(500).json({ error: 'Failed to fetch dashboard summary' });
  }
});

export default router;
