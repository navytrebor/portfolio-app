-- Phase 2.4: High-safety idempotent trade ingestion state.

ALTER TABLE trade_idempotency_keys
  ADD COLUMN IF NOT EXISTS processing_status TEXT NOT NULL DEFAULT 'IN_PROGRESS',
  ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'chk_trade_idempotency_status'
      AND conrelid = 'trade_idempotency_keys'::regclass
  ) THEN
    ALTER TABLE trade_idempotency_keys
      ADD CONSTRAINT chk_trade_idempotency_status
      CHECK (processing_status IN ('IN_PROGRESS', 'COMPLETED'));
  END IF;
END;
$$;

UPDATE trade_idempotency_keys
SET processing_status = 'COMPLETED',
    completed_at = COALESCE(completed_at, created_at)
WHERE trade_id IS NOT NULL
  AND processing_status <> 'COMPLETED';
