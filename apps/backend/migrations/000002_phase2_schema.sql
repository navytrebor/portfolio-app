-- Phase 2.2: PostgreSQL schema for immutable trade ledger and auditable derived state

-- Enforce immutable trade events.
CREATE OR REPLACE FUNCTION prevent_trade_mutation()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'trades table is immutable; create reversal trades instead';
END;
$$ LANGUAGE plpgsql;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_trigger
    WHERE tgname = 'trg_prevent_trade_update'
  ) THEN
    CREATE TRIGGER trg_prevent_trade_update
    BEFORE UPDATE ON trades
    FOR EACH ROW
    EXECUTE FUNCTION prevent_trade_mutation();
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_trigger
    WHERE tgname = 'trg_prevent_trade_delete'
  ) THEN
    CREATE TRIGGER trg_prevent_trade_delete
    BEFORE DELETE ON trades
    FOR EACH ROW
    EXECUTE FUNCTION prevent_trade_mutation();
  END IF;
END;
$$;

ALTER TABLE trades
  ADD COLUMN IF NOT EXISTS event_type TEXT NOT NULL DEFAULT 'EXECUTION',
  ADD COLUMN IF NOT EXISTS reversal_of_trade_id UUID REFERENCES trades(id),
  ADD COLUMN IF NOT EXISTS ingestion_source TEXT;

ALTER TABLE trades
  ADD CONSTRAINT chk_trades_event_type
  CHECK (event_type IN ('EXECUTION', 'REVERSAL', 'CORPORATE_ACTION'));

CREATE INDEX IF NOT EXISTS idx_trades_reversal_of_trade
  ON trades (reversal_of_trade_id)
  WHERE reversal_of_trade_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS trade_idempotency_keys (
  scope TEXT NOT NULL,
  idempotency_key TEXT NOT NULL,
  trade_id UUID REFERENCES trades(id),
  request_hash TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  PRIMARY KEY (scope, idempotency_key)
);

CREATE INDEX IF NOT EXISTS idx_trade_idempotency_expires
  ON trade_idempotency_keys (expires_at);

CREATE TABLE IF NOT EXISTS security_prices (
  security_id UUID NOT NULL REFERENCES securities(id),
  price_date DATE NOT NULL,
  close_price NUMERIC(24, 8) NOT NULL CHECK (close_price > 0),
  currency CHAR(3) NOT NULL,
  source TEXT NOT NULL DEFAULT 'manual',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (security_id, price_date, source)
);

CREATE INDEX IF NOT EXISTS idx_security_prices_date
  ON security_prices (price_date DESC);

CREATE TABLE IF NOT EXISTS fx_rates (
  price_date DATE NOT NULL,
  from_currency CHAR(3) NOT NULL,
  to_currency CHAR(3) NOT NULL,
  rate NUMERIC(20, 10) NOT NULL CHECK (rate > 0),
  source TEXT NOT NULL DEFAULT 'manual',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (price_date, from_currency, to_currency, source),
  CONSTRAINT chk_fx_currency_pair CHECK (from_currency <> to_currency)
);

CREATE INDEX IF NOT EXISTS idx_fx_rates_pair_date
  ON fx_rates (from_currency, to_currency, price_date DESC);

CREATE TABLE IF NOT EXISTS position_snapshots (
  id BIGSERIAL PRIMARY KEY,
  portfolio_id UUID NOT NULL REFERENCES portfolios(id),
  security_id UUID NOT NULL REFERENCES securities(id),
  as_of TIMESTAMPTZ NOT NULL,
  quantity NUMERIC(24, 8) NOT NULL,
  average_cost NUMERIC(24, 8) NOT NULL,
  market_value NUMERIC(24, 8) NOT NULL,
  currency CHAR(3) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (portfolio_id, security_id, as_of)
);

CREATE INDEX IF NOT EXISTS idx_position_snapshots_portfolio_asof
  ON position_snapshots (portfolio_id, as_of DESC);

CREATE TABLE IF NOT EXISTS valuation_snapshots (
  id BIGSERIAL PRIMARY KEY,
  portfolio_id UUID NOT NULL REFERENCES portfolios(id),
  as_of TIMESTAMPTZ NOT NULL,
  securities_value NUMERIC(24, 8) NOT NULL,
  cash_value NUMERIC(24, 8) NOT NULL DEFAULT 0,
  total_value NUMERIC(24, 8) NOT NULL,
  currency CHAR(3) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (portfolio_id, as_of)
);

CREATE INDEX IF NOT EXISTS idx_valuation_snapshots_portfolio_asof
  ON valuation_snapshots (portfolio_id, as_of DESC);

CREATE TABLE IF NOT EXISTS performance_snapshots (
  id BIGSERIAL PRIMARY KEY,
  portfolio_id UUID NOT NULL REFERENCES portfolios(id),
  as_of TIMESTAMPTZ NOT NULL,
  twr NUMERIC(12, 8) NOT NULL,
  mwr NUMERIC(12, 8) NOT NULL,
  drawdown NUMERIC(12, 8) NOT NULL,
  rolling_volatility NUMERIC(12, 8),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (portfolio_id, as_of)
);

CREATE INDEX IF NOT EXISTS idx_performance_snapshots_portfolio_asof
  ON performance_snapshots (portfolio_id, as_of DESC);
