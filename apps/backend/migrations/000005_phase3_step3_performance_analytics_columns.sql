ALTER TABLE performance_snapshots
  ADD COLUMN IF NOT EXISTS benchmark_return NUMERIC(12, 8),
  ADD COLUMN IF NOT EXISTS benchmark_spread NUMERIC(12, 8),
  ADD COLUMN IF NOT EXISTS concentration_hhi NUMERIC(12, 8),
  ADD COLUMN IF NOT EXISTS top_position_weight NUMERIC(12, 8);
