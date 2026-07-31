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
  try {
    fs.mkdirSync(uploadsDir, { recursive: true });
  } catch (e) {
    // ignore directory creation errors
  }
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
    const ext = path.extname(file.originalname).toLowerCase();
    const allowed = ['.csv', '.tsv', '.txt'];
    const validMime = ['text/csv', 'text/plain', 'text/tab-separated-values'].includes(file.mimetype);
    if (allowed.includes(ext) || validMime) {
      cb(null, true);
    } else {
      cb(new Error('Only CSV, TSV, or TXT files are allowed'));
    }
  },
});

const router = Router();

async function ensureDatasetSchema() {
  await query(`
    CREATE TABLE IF NOT EXISTS trade_datasets (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id TEXT NOT NULL,
      name VARCHAR(255) NOT NULL,
      original_filename VARCHAR(255),
      file_path TEXT,
      status VARCHAR(20) NOT NULL DEFAULT 'uploaded',
      column_mapping JSONB,
      row_count INTEGER NOT NULL DEFAULT 0,
      error_message TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )
  `).catch(() => {});
  await query(`CREATE INDEX IF NOT EXISTS idx_trade_datasets_user ON trade_datasets(user_id)`).catch(() => {});
  await query(`
    CREATE TABLE IF NOT EXISTS parsed_trades (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      dataset_id UUID NOT NULL,
      user_id TEXT NOT NULL,
      timestamp TIMESTAMPTZ,
      symbol VARCHAR(50),
      entry_price NUMERIC,
      exit_price NUMERIC,
      pnl NUMERIC,
      side VARCHAR(10),
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `).catch(() => {});
  await query(`CREATE INDEX IF NOT EXISTS idx_parsed_trades_dataset ON parsed_trades(dataset_id)`).catch(() => {});
}

router.get('/', authMiddleware, async (req, res) => {
  try {
    await ensureDatasetSchema();
    const result = await query(
      `SELECT id, name, original_filename, row_count, status, column_mapping, error_message, created_at
       FROM trade_datasets WHERE user_id = $1 ORDER BY created_at DESC`,
      [req.user.id]
    );
    res.json({ datasets: result.rows });
  } catch (err) {
    console.error('Dataset list error:', err);
    res.json({ datasets: [] });
  }
});

router.post('/upload', authMiddleware, upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    await ensureDatasetSchema();

    const { name } = req.body;
    const datasetName = name || req.file.originalname;

    // Insert a real DB record FIRST so we have a valid UUID before parse runs.
    // Do NOT swallow the error — a fake { id: 1 } here is what causes the parse 404.
    let result;
    try {
      result = await query(
        `INSERT INTO trade_datasets (user_id, name, original_filename, file_path, status)
         VALUES ($1, $2, $3, $4, 'uploaded') RETURNING *`,
        [req.user.id, datasetName, req.file.originalname, req.file.path]
      );
    } catch (dbErr) {
      console.error('Dataset insert failed:', dbErr);
      return res.status(500).json({ error: 'Failed to create dataset record in database' });
    }

    const dataset = result.rows[0];

    let rawPreview = { headers: [], rows: [] };
    try {
      rawPreview = await getDatasetPreview(req.file.path);
    } catch (e) {
      // preview is best-effort; dataset record already exists
    }

    // Normalize preview structure to support both keys
    const headers = rawPreview.headers || rawPreview.columns || [];
    const rows = rawPreview.rows || rawPreview.preview || [];

    // Update row_count on the record so the list view is accurate
    const totalRows = rawPreview.totalRows || rows.length;
    await query('UPDATE trade_datasets SET row_count = $1 WHERE id = $2', [totalRows, dataset.id]).catch(() => {});

    const preview = {
      columns: headers,
      headers: headers,
      preview: rows,
      rows: rows,
      totalRows
    };

    res.status(201).json({ dataset: { ...dataset, row_count: totalRows }, preview });
  } catch (err) {
    console.error('Upload error:', err);
    res.status(500).json({ error: err.message || 'Upload failed' });
  }
});

router.get('/:id/preview', authMiddleware, async (req, res) => {
  try {
    await ensureDatasetSchema();
    const result = await query(
      'SELECT * FROM trade_datasets WHERE id = $1 AND user_id = $2',
      [req.params.id, req.user.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Dataset not found' });
    }
    const dataset = result.rows[0];
    let rawPreview = { headers: [], rows: [] };
    try {
      if (dataset.file_path) {
        rawPreview = await getDatasetPreview(dataset.file_path);
      }
    } catch (e) {
      // ignore preview errors
    }

    const headers = rawPreview.headers || rawPreview.columns || [];
    const rows = rawPreview.rows || rawPreview.preview || [];
    const preview = {
      columns: headers,
      headers: headers,
      preview: rows,
      rows: rows,
      totalRows: rawPreview.totalRows || rows.length
    };

    res.json({ dataset, preview });
  } catch (err) {
    res.status(500).json({ error: 'Failed to get preview' });
  }
});

router.post('/:id/parse', authMiddleware, async (req, res) => {
  try {
    const { columnMapping } = req.body;
    if (!columnMapping) {
      return res.status(400).json({ error: 'Column mappings are required' });
    }

    await ensureDatasetSchema();

    const result = await query(
      'SELECT * FROM trade_datasets WHERE id = $1 AND user_id = $2',
      [req.params.id, req.user.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Dataset not found' });
    }

    const dataset = result.rows[0];
    await query('DELETE FROM parsed_trades WHERE dataset_id = $1', [dataset.id]).catch(() => {});

    let parseResult = { success: true, validCount: 0, skipped: 0, errors: [] };
    try {
      parseResult = await parseAndIngestDataset(
        dataset.id,
        req.user.id,
        dataset.file_path,
        columnMapping
      );
      // Mark dataset as processed with row count
      const validCount = parseResult.validCount || parseResult.inserted || 0;
      await query(
        `UPDATE trade_datasets SET status = 'processed', row_count = $1, column_mapping = $2, error_message = NULL WHERE id = $3`,
        [validCount, JSON.stringify(columnMapping), dataset.id]
      ).catch(() => {});
    } catch (e) {
      parseResult = { success: false, validCount: 0, skipped: 0, errors: [e.message] };
      await query(
        `UPDATE trade_datasets SET status = 'failed', error_message = $1 WHERE id = $2`,
        [e.message, dataset.id]
      ).catch(() => {});
    }

    const updated = await query('SELECT * FROM trade_datasets WHERE id = $1', [dataset.id]);
    res.json({ dataset: updated.rows[0], parseResult });
  } catch (err) {
    console.error('Parse error:', err);
    res.status(500).json({ error: err.message || 'Parsing failed' });
  }
});

router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    await ensureDatasetSchema();
    const result = await query(
      'SELECT file_path FROM trade_datasets WHERE id = $1 AND user_id = $2',
      [req.params.id, req.user.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Dataset not found' });
    }

    if (result.rows[0].file_path && fs.existsSync(result.rows[0].file_path)) {
      try {
        fs.unlinkSync(result.rows[0].file_path);
      } catch (e) {
        // ignore unlink errors
      }
    }

    await query('DELETE FROM trade_datasets WHERE id = $1', [req.params.id]).catch(() => {});
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete dataset' });
  }
});

export default router;
