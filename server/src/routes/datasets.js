import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { v4 as uuidv4 } from 'uuid';
import { supabase } from '../db.js';
import { authMiddleware } from '../middleware/auth.js';
import { parseAndIngestDataset, getDatasetPreview, getDatasetPreviewFromContent } from '../services/csvParser.js';

const upload = multer({
  storage: multer.memoryStorage(),
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
    const { data, error } = await supabase
      .from('trade_datasets')
      .select('id, name, original_filename, row_count, status, column_mapping, error_message, created_at')
      .eq('user_id', req.user.id)
      .order('created_at', { ascending: false });

    if (error) throw error;
    res.json({ datasets: data || [] });
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

    const { name } = req.body;
    const datasetName = name || req.file.originalname;

    const fileContent = req.file.buffer.toString('utf8');

    const { data: dataset, error } = await supabase
      .from('trade_datasets')
      .insert({
        user_id: req.user.id,
        name: datasetName,
        original_filename: req.file.originalname,
        file_path: null,
        file_content: fileContent,
        status: 'uploaded',
      })
      .select('*')
      .single();

    if (error) {
      console.error('Dataset insert failed:', JSON.stringify(error, null, 2));
      return res.status(500).json({ error: `Database insert failed: ${error.message || error.details || 'Unknown error'}` });
    }

    let rawPreview = { headers: [], rows: [] };
    try {
      rawPreview = await getDatasetPreviewFromContent(fileContent);
    } catch (e) {
      // preview is best-effort
    }

    const headers = rawPreview.headers || rawPreview.columns || [];
    const rows = rawPreview.rows || rawPreview.preview || [];
    const totalRows = rawPreview.totalRows || rows.length;

    await supabase.from('trade_datasets').update({ row_count: totalRows }).eq('id', dataset.id);

    const preview = {
      columns: headers,
      headers: headers,
      preview: rows,
      rows: rows,
      totalRows,
    };

    res.status(201).json({ dataset: { ...dataset, row_count: totalRows }, preview });
  } catch (err) {
    console.error('Upload error:', err);
    res.status(500).json({ error: err.message || 'Upload failed' });
  }
});

router.get('/:id/preview', authMiddleware, async (req, res) => {
  try {
    const { data: dataset, error } = await supabase
      .from('trade_datasets')
      .select('*')
      .eq('id', req.params.id)
      .eq('user_id', req.user.id)
      .maybeSingle();

    if (!dataset) {
      return res.status(404).json({ error: 'Dataset not found' });
    }

    let rawPreview = { headers: [], rows: [] };
    try {
      if (dataset.file_content) {
        rawPreview = await getDatasetPreviewFromContent(dataset.file_content);
      } else if (dataset.file_path && fs.existsSync(dataset.file_path)) {
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
      totalRows: rawPreview.totalRows || rows.length,
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

    const { data: dataset, error } = await supabase
      .from('trade_datasets')
      .select('*')
      .eq('id', req.params.id)
      .eq('user_id', req.user.id)
      .maybeSingle();

    if (!dataset) {
      return res.status(404).json({ error: 'Dataset not found' });
    }

    await supabase.from('parsed_trades').delete().eq('dataset_id', dataset.id);

    let parseResult = { success: true, validCount: 0, skipped: 0, errors: [] };
    try {
      parseResult = await parseAndIngestDataset(
        dataset.id,
        req.user.id,
        dataset.file_path || null,
        columnMapping,
        dataset.file_content || null
      );
      const validCount = parseResult.validCount || parseResult.inserted || 0;
      await supabase
        .from('trade_datasets')
        .update({
          status: 'processed',
          row_count: validCount,
          column_mapping: JSON.stringify(columnMapping),
          error_message: null,
        })
        .eq('id', dataset.id);
    } catch (e) {
      parseResult = { success: false, validCount: 0, skipped: 0, errors: [e.message] };
      await supabase
        .from('trade_datasets')
        .update({ status: 'failed', error_message: e.message })
        .eq('id', dataset.id);
    }

    const { data: updated } = await supabase.from('trade_datasets').select('*').eq('id', dataset.id).maybeSingle();
    res.json({ dataset: updated, parseResult });
  } catch (err) {
    console.error('Parse error:', err);
    res.status(500).json({ error: err.message || 'Parsing failed' });
  }
});

router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    const { data: dataset } = await supabase
      .from('trade_datasets')
      .select('file_path')
      .eq('id', req.params.id)
      .eq('user_id', req.user.id)
      .maybeSingle();

    if (!dataset) {
      return res.status(404).json({ error: 'Dataset not found' });
    }

    if (dataset.file_path && fs.existsSync(dataset.file_path)) {
      try {
        fs.unlinkSync(dataset.file_path);
      } catch (e) {
        // ignore unlink errors
      }
    }

    await supabase.from('trade_datasets').delete().eq('id', req.params.id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete dataset' });
  }
});

export default router;
