-- Add file_content column to store raw CSV text in the database (survives restarts)
ALTER TABLE trade_datasets
  ADD COLUMN IF NOT EXISTS file_content TEXT;
