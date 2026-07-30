import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { v4 as uuidv4 } from 'uuid';
import { query } from '../db.js';
import { authMiddleware } from '../middleware/auth.js';
import { parseAndIngestDataset, getDatasetPreview } from '../services/csvParser.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const uploadsDir = path.join(__dirname, '../../uploads');

if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: uploadsDir,
  filename: (_req, file, cb) => {
    cb(null, `${uuidv4()}${path.extname(file.originalname)}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype === 'text/csv' || file.originalname.endsWith('.csv')) {
      cb(null, true);
    } else {
      cb(new Error('Only CSV files are allowed'));
    }
  },
});

const router = Router();

router.get('/', authMiddleware, async (req, res) => {
  try {
    const result = await query(
      `SELECT id, name, original_filename, row_count, status, column_mapping, error_message, created_at, updated_at
       FROM trade_datasets WHERE user_id = $1 ORDER BY created_at DESC`,
      [req.user.id]
    );
    res.json({ datasets: result.rows });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch datasets' });
  }
});

router.post('/upload', authMiddleware, upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const { name } = req.body;
    const result = await query(
      `INSERT INTO trade_datasets (user_id, name, original_filename, file_path, status)
       VALUES ($1, $2, $3, $4, 'uploaded') RETURNING *`,
      [req.user.id, name || req.file.originalname, req.file.originalname, req.file.path]
    );

    const preview = getDatasetPreview(req.file.path);
    res.status(201).json({ dataset: result.rows[0], preview });
  } catch (err) {
    console.error('Upload error:', err);
    res.status(500).json({ error: err.message || 'Upload failed' });
  }
});

router.get('/:id/preview', authMiddleware, async (req, res) => {
  try {
    const result = await query(
      'SELECT * FROM trade_datasets WHERE id = $1 AND user_id = $2',
      [req.params.id, req.user.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Dataset not found' });
    }
    const dataset = result.rows[0];
    const preview = getDatasetPreview(dataset.file_path);
    res.json({ dataset, preview });
  } catch (err) {
    res.status(500).json({ error: 'Failed to get preview' });
  }
});

router.post('/:id/parse', authMiddleware, async (req, res) => {
  try {
    const { columnMapping } = req.body;
    if (!columnMapping?.timestamp || !columnMapping?.symbol || !columnMapping?.entry_price || !columnMapping?.exit_price) {
      return res.status(400).json({ error: 'Required column mappings: timestamp, symbol, entry_price, exit_price' });
    }

    const result = await query(
      'SELECT * FROM trade_datasets WHERE id = $1 AND user_id = $2',
      [req.params.id, req.user.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Dataset not found' });
    }

    const dataset = result.rows[0];
    await query('DELETE FROM parsed_trades WHERE dataset_id = $1', [dataset.id]);

    const parseResult = await parseAndIngestDataset(
      dataset.id,
      req.user.id,
      dataset.file_path,
      columnMapping
    );

    const updated = await query('SELECT * FROM trade_datasets WHERE id = $1', [dataset.id]);
    res.json({ dataset: updated.rows[0], parseResult });
  } catch (err) {
    console.error('Parse error:', err);
    res.status(500).json({ error: err.message || 'Parsing failed' });
  }
});

router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    const result = await query(
      'SELECT file_path FROM trade_datasets WHERE id = $1 AND user_id = $2',
      [req.params.id, req.user.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Dataset not found' });
    }

    if (result.rows[0].file_path && fs.existsSync(result.rows[0].file_path)) {
      fs.unlinkSync(result.rows[0].file_path);
    }

    await query('DELETE FROM trade_datasets WHERE id = $1', [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete dataset' });
  }
});

export default router;
