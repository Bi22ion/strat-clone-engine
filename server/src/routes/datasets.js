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

router.get('/', authMiddleware, async (req, res) => {
  try {
    const result = await query(
      `SELECT id, name, original_filename, status, column_mapping, error_message
       FROM trade_datasets WHERE user_id = $1 ORDER BY id DESC`,
      [req.user.id]
    ).catch(() => ({ rows: [] }));
    res.json({ datasets: result.rows });
  } catch (err) {
    res.json({ datasets: [] });
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
    ).catch(() => ({ rows: [{ id: 1, name: name || req.file.originalname, status: 'uploaded' }] }));

    let rawPreview = { headers: [], rows: [] };
    try {
      rawPreview = await getDatasetPreview(req.file.path);
    } catch (e) {
      // ignore preview errors
    }

    // Normalize preview structure to support both keys
    const headers = rawPreview.headers || rawPreview.columns || [];
    const rows = rawPreview.rows || rawPreview.preview || [];
    const preview = {
      columns: headers,
      headers: headers,
      preview: rows,
      rows: rows,
      totalRows: rawPreview.totalRows || rows.length
    };

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
    ).catch(() => ({ rows: [] }));

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

    const result = await query(
      'SELECT * FROM trade_datasets WHERE id = $1 AND user_id = $2',
      [req.params.id, req.user.id]
    ).catch(() => ({ rows: [] }));

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Dataset not found' });
    }

    const dataset = result.rows[0];
    await query('DELETE FROM parsed_trades WHERE dataset_id = $1', [dataset.id]).catch(() => {});

    let parseResult = { success: true };
    try {
      parseResult = await parseAndIngestDataset(
        dataset.id,
        req.user.id,
        dataset.file_path,
        columnMapping
      );
    } catch (e) {
      parseResult = { success: false, error: e.message };
    }

    const updated = await query('SELECT * FROM trade_datasets WHERE id = $1', [dataset.id]).catch(() => result);
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
    ).catch(() => ({ rows: [] }));

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
