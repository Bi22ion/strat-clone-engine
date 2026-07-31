import { parse } from 'csv-parse/sync';
import fs from 'fs';
import path from 'path';
import { supabase } from '../db.js';

const SYMBOL_REGEX = /^[A-Z]{1,10}(\.[A-Z]{1,2})?$/;

const ALLOWED_EXTENSIONS = ['.csv', '.tsv', '.txt'];

export function isAllowedFile(filename) {
  if (!filename) return false;
  const ext = path.extname(filename).toLowerCase();
  return ALLOWED_EXTENSIONS.includes(ext);
}

function detectDelimiter(fileContent, filename) {
  const ext = path.extname(filename || '').toLowerCase();
  if (ext === '.tsv') return '\t';
  if (ext === '.txt') {
    const firstLine = (fileContent.split(/\r?\n/, 1)[0] || '');
    const tabs = (firstLine.match(/\t/g) || []).length;
    const commas = (firstLine.match(/,/g) || []).length;
    return tabs > commas ? '\t' : ',';
  }
  return ',';
}

function parseTimestamp(value) {
  const date = new Date(value);
  if (isNaN(date.getTime())) return null;
  return date.toISOString();
}

function parseNumber(value) {
  if (value === null || value === undefined || value === '') return null;
  const num = parseFloat(String(value).replace(/[$,]/g, ''));
  return isNaN(num) ? null : num;
}

function inferAssetClass(symbol) {
  if (/^(BTC|ETH|SOL|DOGE|XRP)/i.test(symbol)) return 'crypto';
  if (/^(EUR|GBP|JPY|USD)/i.test(symbol)) return 'forex';
  if (/^(SPY|QQQ|IWM|DIA)/i.test(symbol)) return 'etf';
  return 'equity';
}

export async function parseAndIngestDataset(datasetId, userId, filePath, columnMapping) {
  const fileContent = fs.readFileSync(filePath, 'utf8');
  const filename = columnMapping.__filename || filePath;
  const delimiter = detectDelimiter(fileContent, filename);
  const records = parse(fileContent, {
    columns: (header) => header.map(h => String(h).replace(/^\uFEFF/, '').trim()),
    delimiter,
    skip_empty_lines: true,
    trim: true,
    relax_column_count: true,
  });

  if (records.length === 0) {
    throw new Error('CSV file contains no data rows');
  }

  const {
    timestamp: tsCol,
    symbol: symCol,
    entry_price: entryCol,
    exit_price: exitCol,
    pnl: pnlCol,
    side: sideCol,
  } = columnMapping;

  await supabase
    .from('trade_datasets')
    .update({ status: 'processing', column_mapping: JSON.stringify(columnMapping) })
    .eq('id', datasetId);

  let validCount = 0;
  const errors = [];
  const tradeRows = [];

  for (let i = 0; i < records.length; i++) {
    const row = records[i];
    const timestamp = parseTimestamp(row[tsCol]);
    const symbol = String(row[symCol] || '').toUpperCase().trim();
    const entryPrice = parseNumber(row[entryCol]);
    const exitPrice = parseNumber(row[exitCol]);
    let pnl = pnlCol ? parseNumber(row[pnlCol]) : null;
    const side = sideCol ? String(row[sideCol] || '').toLowerCase() : null;

    if (!timestamp) {
      errors.push(`Row ${i + 2}: Invalid timestamp`);
      continue;
    }
    if (!symbol || !SYMBOL_REGEX.test(symbol)) {
      errors.push(`Row ${i + 2}: Invalid symbol "${symbol}"`);
      continue;
    }
    if (entryPrice === null || entryPrice <= 0) {
      errors.push(`Row ${i + 2}: Invalid entry price`);
      continue;
    }
    if (exitPrice === null || exitPrice <= 0) {
      errors.push(`Row ${i + 2}: Invalid exit price`);
      continue;
    }

    if (pnl === null) {
      pnl = exitPrice - entryPrice;
    }

    const assetClass = inferAssetClass(symbol);

    tradeRows.push({
      dataset_id: datasetId,
      user_id: userId,
      timestamp,
      symbol,
      entry_price: entryPrice,
      exit_price: exitPrice,
      pnl,
      side,
      duration_minutes: 0,
      asset_class: assetClass,
    });
    validCount++;
  }

  if (validCount === 0) {
    await supabase
      .from('trade_datasets')
      .update({ status: 'failed', error_message: errors.slice(0, 5).join('; ') })
      .eq('id', datasetId);
    throw new Error(`No valid rows found. Errors: ${errors.slice(0, 3).join('; ')}`);
  }

  // Batch insert trade rows (Supabase has a limit, so insert in chunks)
  const BATCH_SIZE = 500;
  for (let i = 0; i < tradeRows.length; i += BATCH_SIZE) {
    const batch = tradeRows.slice(i, i + BATCH_SIZE);
    const { error: insertError } = await supabase.from('parsed_trades').insert(batch);
    if (insertError) {
      console.error('Insert batch error:', insertError);
    }
  }

  await supabase
    .from('trade_datasets')
    .update({
      status: 'processed',
      row_count: validCount,
      error_message: errors.length > 0 ? `${errors.length} rows skipped` : null,
    })
    .eq('id', datasetId);

  return { validCount, skipped: errors.length, errors: errors.slice(0, 10) };
}

export async function getDatasetPreview(filePath, maxRows = 5) {
  const fileContent = fs.readFileSync(filePath, 'utf8');
  const delimiter = detectDelimiter(fileContent, filePath);
  const records = parse(fileContent, {
    columns: (header) => header.map(h => String(h).replace(/^\uFEFF/, '').trim()),
    delimiter,
    skip_empty_lines: true,
    trim: true,
    relax_column_count: true,
  });
  const columns = records.length > 0 ? Object.keys(records[0]) : [];
  const previewRows = records.slice(0, maxRows);

  return {
    columns,
    headers: columns,
    preview: previewRows,
    rows: previewRows,
    totalRows: records.length,
  };
}
