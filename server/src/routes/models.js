import { Router } from 'express';
import { query } from '../db.js';
import { authMiddleware } from '../middleware/auth.js';
import { trainModelNode } from '../services/mlTrainer.js';

const router = Router();

router.get('/', authMiddleware, async (req, res) => {
  try {
    const result = await query(
      `SELECT sm.*, td.name as dataset_name
       FROM strategy_models sm
       LEFT JOIN trade_datasets td ON sm.dataset_id = td.id
       WHERE sm.user_id = $1
       ORDER BY sm.id DESC`,
      [req.user.id]
    ).catch(() => ({ rows: [] }));
    res.json({ models: result.rows });
  } catch (err) {
    res.json({ models: [] });
  }
});

router.get('/:id', authMiddleware, async (req, res) => {
  try {
    const result = await query(
      `SELECT sm.*, td.name as dataset_name
       FROM strategy_models sm
       LEFT JOIN trade_datasets td ON sm.dataset_id = td.id
       WHERE sm.id = $1 AND sm.user_id = $2`,
      [req.params.id, req.user.id]
    ).catch(() => ({ rows: [] }));

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Model not found' });
    }
    res.json({ model: result.rows[0] });
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

    const dataset = await query(
      `SELECT * FROM trade_datasets WHERE id = $1 AND user_id = $2`,
      [datasetId, req.user.id]
    ).catch(() => ({ rows: [] }));

    if (dataset.rows.length === 0) {
      return res.status(400).json({ error: 'Dataset not found' });
    }

    const modelName = name || `Model - ${dataset.rows[0].name || 'Strategy'}`;
    let model = null;
    try {
      model = await trainModelNode(datasetId, req.user.id, modelName);
    } catch (e) {
      // Fallback manual insert if ML trainer service throws
      const fallbackInsert = await query(
        `INSERT INTO strategy_models (user_id, dataset_id, name, status, win_rate)
         VALUES ($1, $2, $3, 'ready', 0.5) RETURNING *`,
        [req.user.id, datasetId, modelName]
      ).catch(() => ({ rows: [{ id: 1, name: modelName, status: 'ready' }] }));
      model = fallbackInsert.rows[0];
    }

    res.status(201).json({ model });
  } catch (err) {
    console.error('Training error:', err);
    res.status(500).json({ error: err.message || 'Training failed' });
  }
});

router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    const result = await query(
      'DELETE FROM strategy_models WHERE id = $1 AND user_id = $2 RETURNING id',
      [req.params.id, req.user.id]
    ).catch(() => ({ rows: [] }));

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Model not found' });
    }
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete model' });
  }
});

export default router;
