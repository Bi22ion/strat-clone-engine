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

export async function parseAndIngestDataset(datasetId, userId, filePath, columnMapping, fileContent = null) {
  const content = fileContent || (fs.existsSync(filePath) ? fs.readFileSync(filePath, 'utf8') : null);
  if (!content) {
    throw new Error('Dataset file not found. Please re-upload the CSV file.');
  }
  const filename = columnMapping?.__filename || filePath;
  const delimiter = detectDelimiter(content, filename);
  const records = parse(content, {
    columns: (header) => header.map(h => String(h).replace(/^\uFEFF/, '').trim()),
    delimiter,
    skip_empty_lines: true,
    trim: true,
    relax_column_count: true,
  });

  if (records.length === 0) {
    throw new Error('CSV file contains no data rows');
  }

  const columns = records.length > 0 ? Object.keys(records[0]) : [];
  const resolvedMapping = autoDetectColumns(columnMapping || {}, columns);

  await supabase
    .from('trade_datasets')
    .update({ status: 'processing', column_mapping: JSON.stringify(resolvedMapping) })
    .eq('id', datasetId);

  let validCount = 0;
  const errors = [];
  const tradeRows = [];

  for (let i = 0; i < records.length; i++) {
    const row = records[i];
    const timestamp = parseTimestamp(row[resolvedMapping.timestamp]);
    const symbol = String(row[resolvedMapping.symbol] || '').toUpperCase().trim();
    const entryPrice = parseNumber(row[resolvedMapping.entry_price]);
    const exitPrice = parseNumber(row[resolvedMapping.exit_price]);
    let pnl = resolvedMapping.pnl ? parseNumber(row[resolvedMapping.pnl]) : null;
    const side = resolvedMapping.side ? String(row[resolvedMapping.side] || '').toLowerCase() : null;

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

function autoDetectColumns(mapping, columns) {
  const lowerColumns = columns.map((c) => String(c).toLowerCase().trim());
  const findCol = (patterns) => {
    for (const pat of patterns) {
      const regex = typeof pat === 'string' ? new RegExp(pat, 'i') : pat;
      const idx = lowerColumns.findIndex((c) => regex.test(c));
      if (idx >= 0) return columns[idx];
    }
    return null;
  };

  const result = {
    timestamp: mapping.timestamp || findCol([
      /^date$/, /^time$/, /^timestamp$/, /^date_?time$/, /^date_?time$/, /^trade_?date$/, /^exec_?time$/,
      /^filled_?time$/, /^transaction_?time$/, /^created_?at$/,
    ]) || (columns[0] || ''),
    symbol: mapping.symbol || findCol([
      /^symbol$/, /^ticker$/, /^pair$/, /^instrument$/, /^asset$/, /^stock$/, /^contract$/,
    ]) || (columns[1] || ''),
    entry_price: mapping.entry_price || findCol([
      /^entry$/, /^entry_?price$/, /^open$/, /^buy_?price$/, /^price$/, /^open_?price$/,
      /^fill_?price$/, /^exec_?price$/, /^average_?price$/, /^avg_?price$/,
    ]) || (columns[2] || ''),
    exit_price: mapping.exit_price || findCol([
      /^exit$/, /^exit_?price$/, /^close$/, /^sell_?price$/, /^close_?price$/, /^final_?price$/,
      /^exit_?fill$/, /^closing_?price$/,
    ]) || (columns[3] || ''),
    pnl: mapping.pnl || findCol([
      /^pnl$/, /^profit$/, /^gain$/, /^loss$/, /^net$/, /^result$/, /^p_?l$/, /^profit_?loss$/,
      /^realized_?pnl$/, /^unrealized_?pnl$/, /^net_?pnl$/, /^p&l$/,
    ]) || null,
    side: mapping.side || findCol([
      /^side$/, /^action$/, /^type$/, /^direction$/, /^buy_?sell$/, /^long_?short$/,
      /^order_?type$/, /^transaction_?type$/,
    ]) || null,
  };

  return result;
}

export function parseTradesFromCSV(fileContent, columnMapping = {}) {
  const delimiter = detectDelimiter(fileContent, columnMapping.__filename || 'data.csv');
  const records = parse(fileContent, {
    columns: (header) => header.map((h) => String(h).replace(/^\uFEFF/, '').trim()),
    delimiter,
    skip_empty_lines: true,
    trim: true,
    relax_column_count: true,
  });

  if (records.length === 0) return [];

  const columns = Object.keys(records[0]);
  const resolved = autoDetectColumns(columnMapping || {}, columns);
  const trades = [];

  for (let i = 0; i < records.length; i++) {
    const row = records[i];
    const timestamp = parseTimestamp(row[resolved.timestamp]);
    const symbol = String(row[resolved.symbol] || '').toUpperCase().trim();
    const entryPrice = parseNumber(row[resolved.entry_price]);
    const exitPrice = parseNumber(row[resolved.exit_price]);
    let pnl = resolved.pnl ? parseNumber(row[resolved.pnl]) : null;
    const side = resolved.side ? String(row[resolved.side] || '').toLowerCase() : null;

    if (!timestamp || !symbol || !SYMBOL_REGEX.test(symbol)) continue;
    if (entryPrice === null || entryPrice <= 0) continue;
    if (exitPrice === null || exitPrice <= 0) continue;

    if (pnl === null) {
      pnl = exitPrice - entryPrice;
    }

    trades.push({
      timestamp,
      symbol,
      entry_price: entryPrice,
      exit_price: exitPrice,
      pnl,
      side,
      duration_minutes: 0,
      asset_class: inferAssetClass(symbol),
    });
  }

  return trades;
}

export async function getDatasetPreviewFromContent(content, maxRows = 5) {
  const delimiter = detectDelimiter(content, 'preview.csv');
  const records = parse(content, {
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

export async function getDatasetPreview(filePath, maxRows = 5) {
  const fileContent = fs.existsSync(filePath) ? fs.readFileSync(filePath, 'utf8') : '';
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
