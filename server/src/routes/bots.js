import { Router } from 'express';
import { supabase } from '../db.js';
import { authMiddleware } from '../middleware/auth.js';
import { AlpacaBroker } from '../services/brokerService.js';

const router = Router();

router.get('/', authMiddleware, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('trading_bots')
      .select('*')
      .eq('user_id', req.user.id)
      .order('created_at', { ascending: false });

    if (error) throw error;

    // Enrich with model info
    const enriched = await Promise.all((data || []).map(async (bot) => {
      if (bot.model_id) {
        const { data: model } = await supabase
          .from('strategy_models')
          .select('name, win_rate, status')
          .eq('id', bot.model_id)
          .maybeSingle();
        return {
          ...bot,
          model_name: model?.name || null,
          win_rate: model?.win_rate || null,
          model_status: model?.status || null,
        };
      }
      return bot;
    }));

    res.json({ bots: enriched });
  } catch (err) {
    res.json({ bots: [] });
  }
});

router.post('/', authMiddleware, async (req, res) => {
  try {
    const { modelId, name, maxDailyLoss = 1000 } = req.body;
    if (!modelId) {
      return res.status(400).json({ error: 'modelId is required' });
    }

    const { data: model } = await supabase
      .from('strategy_models')
      .select('*')
      .eq('id', modelId)
      .eq('user_id', req.user.id)
      .maybeSingle();

    if (!model) {
      return res.status(400).json({ error: 'Model not found' });
    }

    const { data, error } = await supabase
      .from('trading_bots')
      .insert({
        user_id: req.user.id,
        model_id: modelId,
        name: name || `Bot - ${model.name}`,
        max_daily_loss: maxDailyLoss,
        status: 'inactive',
      })
      .select('*')
      .single();

    if (error) throw error;
    res.status(201).json({ bot: data });
  } catch (err) {
    console.error('Create bot error:', err);
    res.status(500).json({ error: 'Failed to create bot' });
  }
});

router.patch('/:id/start', authMiddleware, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('trading_bots')
      .update({ status: 'active' })
      .eq('id', req.params.id)
      .eq('user_id', req.user.id)
      .select('*');

    if (error || !data || data.length === 0) {
      return res.status(404).json({ error: 'Bot not found' });
    }
    res.json({ bot: data[0] });
  } catch (err) {
    res.status(500).json({ error: 'Failed to start bot' });
  }
});

router.patch('/:id/stop', authMiddleware, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('trading_bots')
      .update({ status: 'inactive' })
      .eq('id', req.params.id)
      .eq('user_id', req.user.id)
      .select('*');

    if (error || !data || data.length === 0) {
      return res.status(404).json({ error: 'Bot not found' });
    }
    res.json({ bot: data[0] });
  } catch (err) {
    res.status(500).json({ error: 'Failed to stop bot' });
  }
});

router.patch('/:id/risk', authMiddleware, async (req, res) => {
  try {
    const { maxDailyLoss } = req.body;
    const { data, error } = await supabase
      .from('trading_bots')
      .update({ max_daily_loss: maxDailyLoss })
      .eq('id', req.params.id)
      .eq('user_id', req.user.id)
      .select('*');

    if (error || !data || data.length === 0) {
      return res.status(404).json({ error: 'Bot not found' });
    }
    res.json({ bot: data[0] });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update risk settings' });
  }
});

router.post('/kill-switch', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;

    const { data: activeBots } = await supabase
      .from('trading_bots')
      .update({ status: 'stopped_emergency' })
      .eq('user_id', userId)
      .eq('status', 'active')
      .select('*');

    const { data: credentials } = await supabase
      .from('broker_credentials')
      .select('*')
      .eq('user_id', userId)
      .limit(1)
      .maybeSingle();

    let closeResult = null;
    if (credentials) {
      try {
        const broker = AlpacaBroker.fromCredentials(credentials);
        closeResult = await broker.closeAllPositions();
      } catch (err) {
        closeResult = { error: err.message };
      }
    }

    await supabase.from('execution_logs').insert({
      user_id: userId,
      action: 'EMERGENCY_KILL',
      status: 'executed',
      message: 'Emergency kill switch activated - all bots stopped',
    });

    res.json({
      success: true,
      botsStopped: activeBots?.length || 0,
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
    const { data, error } = await supabase
      .from('execution_logs')
      .select('*')
      .eq('user_id', req.user.id)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) throw error;

    // Enrich with bot names
    const enriched = await Promise.all((data || []).map(async (log) => {
      if (log.bot_id) {
        const { data: bot } = await supabase
          .from('trading_bots')
          .select('name')
          .eq('id', log.bot_id)
          .maybeSingle();
        return { ...log, bot_name: bot?.name || null };
      }
      return log;
    }));

    res.json({ logs: enriched });
  } catch (err) {
    res.json({ logs: [] });
  }
});

export default router;
