import { parse } from 'csv-parse/sync';
import fs from 'fs';
import { query } from '../db.js';

const SYMBOL_REGEX = /^[A-Z]{1,10}(\.[A-Z]{1,2})?$/;

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

function calculateDurationMinutes(entry, exit) {
  const diff = new Date(exit).getTime() - new Date(entry).getTime();
  return Math.max(0, Math.round(diff / 60000));
}

export async function parseAndIngestDataset(datasetId, userId, filePath, columnMapping) {
  const fileContent = fs.readFileSync(filePath, 'utf8');
  const records = parse(fileContent, {
    columns: true,
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

  await query(
    `UPDATE trade_datasets SET status = 'processing', column_mapping = $1 WHERE id = $2`,
    [JSON.stringify(columnMapping), datasetId]
  );

  let validCount = 0;
  const errors = [];

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

    const durationMinutes = calculateDurationMinutes(timestamp, timestamp);
    const assetClass = inferAssetClass(symbol);

    await query(
      `INSERT INTO parsed_trades (dataset_id, user_id, timestamp, symbol, entry_price, exit_price, pnl, side, duration_minutes, asset_class)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
      [datasetId, userId, timestamp, symbol, entryPrice, exitPrice, pnl, side, durationMinutes, assetClass]
    );
    validCount++;
  }

  if (validCount === 0) {
    await query(
      `UPDATE trade_datasets SET status = 'failed', error_message = $1 WHERE id = $2`,
      [errors.slice(0, 5).join('; '), datasetId]
    );
    throw new Error(`No valid rows found. Errors: ${errors.slice(0, 3).join('; ')}`);
  }

  await query(
    `UPDATE trade_datasets SET status = 'processed', row_count = $1, error_message = $2 WHERE id = $3`,
    [validCount, errors.length > 0 ? `${errors.length} rows skipped` : null, datasetId]
  );

  return { validCount, skipped: errors.length, errors: errors.slice(0, 10) };
}

export async function getDatasetPreview(filePath, maxRows = 5) {
  const fileContent = fs.readFileSync(filePath, 'utf8');
  const records = parse(fileContent, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
    relax_column_count: true,
  });
  const columns = records.length > 0 ? Object.keys(records[0]) : [];
  return { columns, preview: records.slice(0, maxRows), totalRows: records.length };
}
