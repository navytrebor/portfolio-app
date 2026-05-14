CREATE TEMP TABLE desired_users (
  id UUID PRIMARY KEY,
  email TEXT NOT NULL UNIQUE
) ON COMMIT DROP;

INSERT INTO desired_users (id, email)
VALUES
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'alice@example.com'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'bob@example.com'),
  ('cccccccc-cccc-cccc-cccc-cccccccccccc', 'carol@example.com');

UPDATE users AS existing
SET email = 'seed-legacy-' || existing.id::text || '@example.invalid'
FROM desired_users AS desired
WHERE existing.email = desired.email
  AND existing.id <> desired.id;

INSERT INTO users (id, email)
SELECT id, email
FROM desired_users
ON CONFLICT (id) DO UPDATE
SET email = EXCLUDED.email;

CREATE TEMP TABLE desired_portfolios (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  base_currency CHAR(3) NOT NULL,
  UNIQUE (user_id, name)
) ON COMMIT DROP;

INSERT INTO desired_portfolios (id, user_id, name, base_currency)
VALUES
  ('11111111-1111-1111-1111-111111111111', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Alice Growth', 'USD'),
  ('33333333-3333-3333-3333-333333333333', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'Bob Diversified', 'EUR'),
  ('44444444-4444-4444-4444-444444444444', 'cccccccc-cccc-cccc-cccc-cccccccccccc', 'Carol Income', 'CHF');

UPDATE portfolios AS existing
SET name = existing.name || ' [legacy ' || existing.id::text || ']'
FROM desired_portfolios AS desired
WHERE existing.user_id = desired.user_id
  AND existing.name = desired.name
  AND existing.id <> desired.id;

INSERT INTO portfolios (id, user_id, name, base_currency)
SELECT id, user_id, name, base_currency
FROM desired_portfolios
ON CONFLICT (id) DO UPDATE
SET user_id = EXCLUDED.user_id,
    name = EXCLUDED.name,
    base_currency = EXCLUDED.base_currency;

CREATE TEMP TABLE desired_securities (
  id UUID PRIMARY KEY,
  ticker TEXT NOT NULL UNIQUE,
  isin TEXT,
  security_type TEXT NOT NULL,
  currency CHAR(3) NOT NULL
) ON COMMIT DROP;

INSERT INTO desired_securities (id, ticker, isin, security_type, currency)
VALUES
  ('22222222-2222-2222-2222-222222222222', 'AAPL', 'US0378331005', 'EQUITY', 'USD'),
  ('55555555-5555-5555-5555-555555555555', 'MSFT', 'US5949181045', 'EQUITY', 'USD'),
  ('66666666-6666-6666-6666-666666666666', 'SAP', 'DE0007164600', 'EQUITY', 'EUR'),
  ('77777777-7777-7777-7777-777777777777', 'NESN', 'CH0038863350', 'EQUITY', 'CHF'),
  ('88888888-8888-8888-8888-888888888888', 'SPY', 'US78462F1030', 'ETF', 'USD'),
  ('99999999-9999-9999-9999-999999999999', 'VGK', 'US9220427754', 'ETF', 'EUR');

-- Move conflicting legacy rows aside so deterministic seed ids can be inserted
-- without deleting referenced data; clearing ISIN releases the partial unique index.
UPDATE securities AS existing
SET ticker = existing.ticker || '-legacy-'
      || substring(replace(existing.id::text, '-', '') from 1 for 8),
    isin = NULL
FROM desired_securities AS desired
WHERE existing.id <> desired.id
  AND (
    existing.ticker = desired.ticker
    OR (
      existing.isin IS NOT NULL
      AND desired.isin IS NOT NULL
      AND existing.isin = desired.isin
    )
  );

INSERT INTO securities (id, ticker, isin, security_type, currency)
SELECT id, ticker, isin, security_type, currency
FROM desired_securities
ON CONFLICT (id) DO UPDATE
SET ticker = EXCLUDED.ticker,
    isin = EXCLUDED.isin,
    security_type = EXCLUDED.security_type,
    currency = EXCLUDED.currency;
