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
       JOIN trade_datasets td ON sm.dataset_id = td.id
       WHERE sm.user_id = $1
       ORDER BY sm.created_at DESC`,
      [req.user.id]
    );
    res.json({ models: result.rows });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch models' });
  }
});

router.get('/:id', authMiddleware, async (req, res) => {
  try {
    const result = await query(
      `SELECT sm.*, td.name as dataset_name, td.row_count
       FROM strategy_models sm
       JOIN trade_datasets td ON sm.dataset_id = td.id
       WHERE sm.id = $1 AND sm.user_id = $2`,
      [req.params.id, req.user.id]
    );
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
      `SELECT * FROM trade_datasets WHERE id = $1 AND user_id = $2 AND status = 'processed'`,
      [datasetId, req.user.id]
    );
    if (dataset.rows.length === 0) {
      return res.status(400).json({ error: 'Processed dataset not found' });
    }

    const modelName = name || `Model - ${dataset.rows[0].name}`;
    const model = await trainModelNode(datasetId, req.user.id, modelName);
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
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Model not found' });
    }
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete model' });
  }
});

export default router;
