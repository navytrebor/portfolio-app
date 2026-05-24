-- Phase 2.4 fix: reserve trade IDs without violating FK before trade insert.

ALTER TABLE trade_idempotency_keys
  ADD COLUMN IF NOT EXISTS reserved_trade_id UUID;

UPDATE trade_idempotency_keys
SET reserved_trade_id = COALESCE(reserved_trade_id, trade_id, gen_random_uuid())
WHERE reserved_trade_id IS NULL;

ALTER TABLE trade_idempotency_keys
  ALTER COLUMN reserved_trade_id SET NOT NULL;
