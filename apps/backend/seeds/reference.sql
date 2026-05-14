INSERT INTO users (id, email)
VALUES
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'alice@example.com'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'bob@example.com'),
  ('cccccccc-cccc-cccc-cccc-cccccccccccc', 'carol@example.com')
ON CONFLICT (id) DO UPDATE
SET email = EXCLUDED.email;

INSERT INTO portfolios (id, user_id, name, base_currency)
VALUES
  ('11111111-1111-1111-1111-111111111111', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Alice Growth', 'USD'),
  ('33333333-3333-3333-3333-333333333333', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'Bob Diversified', 'EUR'),
  ('44444444-4444-4444-4444-444444444444', 'cccccccc-cccc-cccc-cccc-cccccccccccc', 'Carol Income', 'CHF')
ON CONFLICT (id) DO UPDATE
SET user_id = EXCLUDED.user_id,
    name = EXCLUDED.name,
    base_currency = EXCLUDED.base_currency;

INSERT INTO securities (id, ticker, isin, security_type, currency)
VALUES
  ('22222222-2222-2222-2222-222222222222', 'AAPL', 'US0378331005', 'EQUITY', 'USD'),
  ('55555555-5555-5555-5555-555555555555', 'MSFT', 'US5949181045', 'EQUITY', 'USD'),
  ('66666666-6666-6666-6666-666666666666', 'SAP', 'DE0007164600', 'EQUITY', 'EUR'),
  ('77777777-7777-7777-7777-777777777777', 'NESN', 'CH0038863350', 'EQUITY', 'CHF'),
  ('88888888-8888-8888-8888-888888888888', 'SPY', 'US78462F1030', 'ETF', 'USD'),
  ('99999999-9999-9999-9999-999999999999', 'VGK', 'US9220427754', 'ETF', 'EUR')
ON CONFLICT (id) DO UPDATE
SET ticker = EXCLUDED.ticker,
    isin = EXCLUDED.isin,
    security_type = EXCLUDED.security_type,
    currency = EXCLUDED.currency;
