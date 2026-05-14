import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Client } from "pg";
import { env } from "../config/env";

type SeedMode = "upsert" | "reset";
type SeedScale = "smoke" | "medium" | "large";

type ScaleConfig = {
  portfolios: number;
  tradesPerPortfolio: number;
  priceDays: number;
};

type SecuritySeed = {
  id: string;
  ticker: string;
  currency: "USD" | "EUR" | "CHF";
  basePrice: number;
  volatility: number;
};

type PortfolioSeed = {
  id: string;
  baseCurrency: "USD" | "EUR" | "CHF";
};

const SCALE_CONFIG: Record<SeedScale, ScaleConfig> = {
  smoke: {
    portfolios: 1,
    tradesPerPortfolio: 20,
    priceDays: 60,
  },
  medium: {
    portfolios: 3,
    tradesPerPortfolio: 100,
    priceDays: 260,
  },
  large: {
    portfolios: 10,
    tradesPerPortfolio: 300,
    priceDays: 520,
  },
};

const PORTFOLIOS: PortfolioSeed[] = [
  { id: "11111111-1111-1111-1111-111111111111", baseCurrency: "USD" },
  { id: "33333333-3333-3333-3333-333333333333", baseCurrency: "EUR" },
  { id: "44444444-4444-4444-4444-444444444444", baseCurrency: "CHF" },
];

const SECURITIES: SecuritySeed[] = [
  {
    id: "22222222-2222-2222-2222-222222222222",
    ticker: "AAPL",
    currency: "USD",
    basePrice: 180,
    volatility: 0.018,
  },
  {
    id: "55555555-5555-5555-5555-555555555555",
    ticker: "MSFT",
    currency: "USD",
    basePrice: 350,
    volatility: 0.015,
  },
  {
    id: "66666666-6666-6666-6666-666666666666",
    ticker: "SAP",
    currency: "EUR",
    basePrice: 150,
    volatility: 0.013,
  },
  {
    id: "77777777-7777-7777-7777-777777777777",
    ticker: "NESN",
    currency: "CHF",
    basePrice: 110,
    volatility: 0.01,
  },
  {
    id: "88888888-8888-8888-8888-888888888888",
    ticker: "SPY",
    currency: "USD",
    basePrice: 520,
    volatility: 0.009,
  },
  {
    id: "99999999-9999-9999-9999-999999999999",
    ticker: "VGK",
    currency: "EUR",
    basePrice: 65,
    volatility: 0.011,
  },
];

const END_DATE = new Date("2026-12-31T00:00:00.000Z");
const SYNTHETIC_SOURCE = "synthetic-v1";

function parseArg(name: string, fallback: string): string {
  const prefix = `--${name}=`;
  const match = process.argv.find((arg) => arg.startsWith(prefix));
  if (!match) {
    return fallback;
  }
  return match.slice(prefix.length);
}

function parseMode(): SeedMode {
  const mode = parseArg("mode", "upsert");
  if (mode === "upsert" || mode === "reset") {
    return mode;
  }
  throw new Error(`Unsupported --mode value: ${mode}`);
}

function parseScale(): SeedScale {
  const scale = parseArg("scale", "medium");
  if (scale === "smoke" || scale === "medium" || scale === "large") {
    return scale;
  }
  throw new Error(`Unsupported --scale value: ${scale}`);
}

function stringHash(seed: string): number {
  return createHash("sha256").update(seed).digest().readUInt32BE(0);
}

function mulberry32(seed: number): () => number {
  let t = seed;
  return () => {
    t += 0x6d2b79f5;
    let value = Math.imul(t ^ (t >>> 15), 1 | t);
    value ^= value + Math.imul(value ^ (value >>> 7), 61 | value);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

function deterministicUuid(input: string): string {
  const hex = createHash("sha1").update(input).digest("hex").slice(0, 32);
  const variant = ((Number.parseInt(hex[16], 16) & 0x3) | 0x8).toString(16);
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-5${hex.slice(13, 16)}-${variant}${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
}

function toDateOnly(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function toAsOf(date: Date): string {
  return `${toDateOnly(date)}T17:00:00.000Z`;
}

function businessDates(days: number): Date[] {
  const result: Date[] = [];
  let current = new Date(END_DATE);

  while (result.length < days) {
    const weekday = current.getUTCDay();
    if (weekday !== 0 && weekday !== 6) {
      result.push(new Date(current));
    }
    current.setUTCDate(current.getUTCDate() - 1);
  }

  return result.reverse();
}

async function runReferenceSeed(client: Client): Promise<void> {
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);
  const referencePath = path.resolve(__dirname, "../../seeds/reference.sql");
  const sql = await fs.readFile(referencePath, "utf8");
  await client.query(sql);
}

async function resetData(client: Client): Promise<void> {
  await client.query(`
    TRUNCATE TABLE
      performance_snapshots,
      valuation_snapshots,
      position_snapshots,
      trade_idempotency_keys,
      trades,
      fx_rates,
      security_prices,
      securities,
      portfolios,
      users
    RESTART IDENTITY CASCADE
  `);
}

async function seedSecurityPrices(
  client: Client,
  dates: Date[],
  random: () => number,
): Promise<Map<string, Map<string, number>>> {
  const prices = new Map<string, Map<string, number>>();

  for (const security of SECURITIES) {
    let current = security.basePrice;
    const byDate = new Map<string, number>();

    for (const date of dates) {
      const shock = (random() - 0.5) * security.volatility;
      current = Math.max(1, current * (1 + shock));
      const rounded = Number(current.toFixed(4));
      const dateOnly = toDateOnly(date);
      byDate.set(dateOnly, rounded);

      await client.query(
        `
        INSERT INTO security_prices (security_id, price_date, close_price, currency, source)
        VALUES ($1, $2::date, $3, $4, $5)
        ON CONFLICT (security_id, price_date, source)
        DO UPDATE SET close_price = EXCLUDED.close_price,
                      currency = EXCLUDED.currency
        `,
        [security.id, dateOnly, rounded, security.currency, SYNTHETIC_SOURCE],
      );
    }

    prices.set(security.id, byDate);
  }

  return prices;
}

function fxBase(from: string, to: string): number {
  if (from === to) {
    return 1;
  }

  const pair = `${from}/${to}`;
  switch (pair) {
    case "USD/EUR":
      return 0.92;
    case "EUR/USD":
      return 1.087;
    case "USD/CHF":
      return 0.89;
    case "CHF/USD":
      return 1.124;
    case "EUR/CHF":
      return 0.97;
    case "CHF/EUR":
      return 1.031;
    default:
      return 1;
  }
}

async function seedFxRates(
  client: Client,
  dates: Date[],
  random: () => number,
): Promise<void> {
  const pairs: Array<[string, string]> = [
    ["USD", "EUR"],
    ["EUR", "USD"],
    ["USD", "CHF"],
    ["CHF", "USD"],
    ["EUR", "CHF"],
    ["CHF", "EUR"],
  ];

  for (const date of dates) {
    const dateOnly = toDateOnly(date);

    for (const [fromCurrency, toCurrency] of pairs) {
      const jitter = 1 + (random() - 0.5) * 0.01;
      const rate = Number((fxBase(fromCurrency, toCurrency) * jitter).toFixed(8));

      await client.query(
        `
        INSERT INTO fx_rates (price_date, from_currency, to_currency, rate, source)
        VALUES ($1::date, $2, $3, $4, $5)
        ON CONFLICT (price_date, from_currency, to_currency, source)
        DO UPDATE SET rate = EXCLUDED.rate
        `,
        [dateOnly, fromCurrency, toCurrency, rate, SYNTHETIC_SOURCE],
      );
    }
  }
}

async function seedTrades(
  client: Client,
  mode: SeedMode,
  scale: ScaleConfig,
  dates: Date[],
  prices: Map<string, Map<string, number>>,
  random: () => number,
): Promise<void> {
  const portfolios = PORTFOLIOS.slice(0, scale.portfolios);

  for (const portfolio of portfolios) {
    for (let i = 0; i < scale.tradesPerPortfolio; i += 1) {
      const security = SECURITIES[Math.floor(random() * SECURITIES.length)];
      const date = dates[Math.floor(random() * dates.length)];
      const dateOnly = toDateOnly(date);
      const byDate = prices.get(security.id);
      const refPrice = byDate?.get(dateOnly) ?? security.basePrice;
      const quantity = Math.floor(random() * 45) + 5;
      const side = random() < 0.62 ? "BUY" : "SELL";
      const noise = 1 + (random() - 0.5) * 0.02;
      const tradePrice = Number((refPrice * noise).toFixed(4));
      const tradeId = deterministicUuid(
        `${SYNTHETIC_SOURCE}:trade:${portfolio.id}:${security.id}:${i}`,
      );

      await client.query(
        `
        INSERT INTO trades (
          id,
          portfolio_id,
          security_id,
          side,
          quantity,
          price,
          trade_date,
          currency,
          event_type,
          ingestion_source
        )
        VALUES (
          $1,
          $2,
          $3,
          $4,
          $5,
          $6,
          $7::timestamptz,
          $8,
          'EXECUTION',
          $9
        )
        ON CONFLICT (id) DO NOTHING
        `,
        [
          tradeId,
          portfolio.id,
          security.id,
          side,
          quantity,
          tradePrice,
          `${dateOnly}T14:30:00.000Z`,
          security.currency,
          SYNTHETIC_SOURCE,
        ],
      );

      if (mode === "upsert") {
        continue;
      }
    }
  }
}

async function seedPositionAndValuationSnapshots(
  client: Client,
  scale: ScaleConfig,
  dates: Date[],
  random: () => number,
): Promise<void> {
  const portfolios = PORTFOLIOS.slice(0, scale.portfolios);

  for (const portfolio of portfolios) {
    const monthEndDates = dates.filter((_, index) => index % 21 === 20);
    let totalValue = 100000 + random() * 15000;

    for (const asOfDate of monthEndDates) {
      totalValue = totalValue * (1 + (random() - 0.45) * 0.035);
      const securitiesValue = Number((totalValue * 0.92).toFixed(4));
      const cashValue = Number((totalValue * 0.08).toFixed(4));
      const asOf = toAsOf(asOfDate);

      await client.query(
        `
        INSERT INTO valuation_snapshots (
          portfolio_id,
          as_of,
          securities_value,
          cash_value,
          total_value,
          currency
        )
        VALUES ($1, $2::timestamptz, $3, $4, $5, $6)
        ON CONFLICT (portfolio_id, as_of)
        DO UPDATE SET
          securities_value = EXCLUDED.securities_value,
          cash_value = EXCLUDED.cash_value,
          total_value = EXCLUDED.total_value,
          currency = EXCLUDED.currency
        `,
        [
          portfolio.id,
          asOf,
          securitiesValue,
          cashValue,
          Number(totalValue.toFixed(4)),
          portfolio.baseCurrency,
        ],
      );

      await client.query(
        `
        INSERT INTO performance_snapshots (
          portfolio_id,
          as_of,
          twr,
          mwr,
          drawdown,
          rolling_volatility
        )
        VALUES ($1, $2::timestamptz, $3, $4, $5, $6)
        ON CONFLICT (portfolio_id, as_of)
        DO UPDATE SET
          twr = EXCLUDED.twr,
          mwr = EXCLUDED.mwr,
          drawdown = EXCLUDED.drawdown,
          rolling_volatility = EXCLUDED.rolling_volatility
        `,
        [
          portfolio.id,
          asOf,
          Number(((random() - 0.35) * 0.18).toFixed(8)),
          Number(((random() - 0.4) * 0.15).toFixed(8)),
          Number((random() * 0.22).toFixed(8)),
          Number((0.07 + random() * 0.08).toFixed(8)),
        ],
      );
    }

    const latestAsOf = toAsOf(dates[dates.length - 1]);
    const securityCount = Math.min(4, SECURITIES.length);
    for (let i = 0; i < securityCount; i += 1) {
      const security = SECURITIES[(i + Math.floor(random() * 2)) % SECURITIES.length];
      const quantity = Number((20 + random() * 180).toFixed(6));
      const averageCost = Number((security.basePrice * (0.92 + random() * 0.1)).toFixed(6));
      const marketValue = Number((quantity * security.basePrice).toFixed(6));

      await client.query(
        `
        INSERT INTO position_snapshots (
          portfolio_id,
          security_id,
          as_of,
          quantity,
          average_cost,
          market_value,
          currency
        )
        VALUES ($1, $2, $3::timestamptz, $4, $5, $6, $7)
        ON CONFLICT (portfolio_id, security_id, as_of)
        DO UPDATE SET
          quantity = EXCLUDED.quantity,
          average_cost = EXCLUDED.average_cost,
          market_value = EXCLUDED.market_value,
          currency = EXCLUDED.currency
        `,
        [
          portfolio.id,
          security.id,
          latestAsOf,
          quantity,
          averageCost,
          marketValue,
          security.currency,
        ],
      );
    }
  }
}

async function run() {
  const mode = parseMode();
  const scaleName = parseScale();
  const seed = parseArg("seed", "phase2-default-001");
  const scale = SCALE_CONFIG[scaleName];
  const dates = businessDates(scale.priceDays);
  const random = mulberry32(stringHash(seed));

  const client = new Client({
    host: env.POSTGRES_HOST,
    port: env.POSTGRES_PORT,
    database: env.POSTGRES_DB,
    user: env.POSTGRES_USER,
    password: env.POSTGRES_PASSWORD,
    ssl: env.POSTGRES_SSL
      ? { rejectUnauthorized: process.env.POSTGRES_SSL_SKIP_VERIFY !== "true" }
      : false,
  });

  await client.connect();

  try {
    await client.query("BEGIN");

    if (mode === "reset") {
      await resetData(client);
    }

    await runReferenceSeed(client);
    const prices = await seedSecurityPrices(client, dates, random);
    await seedFxRates(client, dates, random);
    await seedTrades(client, mode, scale, dates, prices, random);
    await seedPositionAndValuationSnapshots(client, scale, dates, random);

    await client.query("COMMIT");

    console.log(
      `Seed complete (mode=${mode}, scale=${scaleName}, seed=${seed}, source=${SYNTHETIC_SOURCE})`,
    );
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    await client.end();
  }
}

run().catch((error) => {
  console.error("Seed failed", error);
  process.exitCode = 1;
});
