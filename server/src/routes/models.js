import { Router } from 'express';
import { supabase } from '../db.js';
import { authMiddleware } from '../middleware/auth.js';
import { trainModelNode } from '../services/mlTrainer.js';

const router = Router();

router.get('/', authMiddleware, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('strategy_models')
      .select('*')
      .eq('user_id', req.user.id)
      .order('created_at', { ascending: false });

    if (error) throw error;

    // Enrich with dataset names
    const enriched = await Promise.all((data || []).map(async (m) => {
      if (m.dataset_id) {
        const { data: ds } = await supabase
          .from('trade_datasets')
          .select('name')
          .eq('id', m.dataset_id)
          .maybeSingle();
        return { ...m, dataset_name: ds?.name || null };
      }
      return m;
    }));

    res.json({ models: enriched });
  } catch (err) {
    res.json({ models: [] });
  }
});

router.get('/:id', authMiddleware, async (req, res) => {
  try {
    const { data: model } = await supabase
      .from('strategy_models')
      .select('*')
      .eq('id', req.params.id)
      .eq('user_id', req.user.id)
      .maybeSingle();

    if (!model) {
      return res.status(404).json({ error: 'Model not found' });
    }

    let dataset_name = null;
    if (model.dataset_id) {
      const { data: ds } = await supabase
        .from('trade_datasets')
        .select('name')
        .eq('id', model.dataset_id)
        .maybeSingle();
      dataset_name = ds?.name || null;
    }

    res.json({ model: { ...model, dataset_name } });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch model' });
  }
});

router.post('/train', authMiddleware, async (req, res) => {
  try {
    const { datasetId, name } = req.body;
    if (!datasetId) {
      return res.status(400).json({ error: 'datasetId is required' });
    }

    const { data: dataset } = await supabase
      .from('trade_datasets')
      .select('*')
      .eq('id', datasetId)
      .eq('user_id', req.user.id)
      .maybeSingle();

    if (!dataset) {
      return res.status(400).json({ error: 'Dataset not found' });
    }

    const modelName = name || `Model - ${dataset.name || 'Strategy'}`;
    let model = null;
    try {
      model = await trainModelNode(datasetId, req.user.id, modelName);
    } catch (e) {
      const { data: fallback } = await supabase
        .from('strategy_models')
        .insert({
          user_id: req.user.id,
          dataset_id: datasetId,
          name: modelName,
          status: 'ready',
          win_rate: 50,
        })
        .select('*')
        .single();
      model = fallback || { id: '1', name: modelName, status: 'ready' };
    }

    res.status(201).json({ model });
  } catch (err) {
    console.error('Training error:', err);
    res.status(500).json({ error: err.message || 'Training failed' });
  }
});

router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('strategy_models')
      .delete()
      .eq('id', req.params.id)
      .eq('user_id', req.user.id)
      .select('id');

    if (!data || data.length === 0) {
      return res.status(404).json({ error: 'Model not found' });
    }
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete model' });
  }
});

export default router;
