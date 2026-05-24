import type { Pool } from "pg";
import type {
  FreshnessStatus,
  FxRate,
  FxRateIngestRecord,
  IngestionWriteSummary,
  SecurityPrice,
  SecurityPriceIngestRecord,
} from "../domain/market-data";
import type { PricingFxRepository } from "../repositories/pricing-fx-repository";

type SecurityPriceRow = {
  security_id: string;
  price_date: Date;
  close_price: string;
  currency: string;
};

type FxRateRow = {
  from_currency: string;
  to_currency: string;
  price_date: Date;
  rate: string;
};

export class PostgresPricingFxRepository implements PricingFxRepository {
  constructor(private readonly pool: Pool) {}

  async getSecurityPrice(securityId: string, asOf: string): Promise<SecurityPrice | null> {
    const asOfDate = asOf.slice(0, 10);
    const result = await this.pool.query<SecurityPriceRow>(
      `
      SELECT security_id, price_date, close_price, currency
      FROM security_prices
      WHERE security_id = $1 AND price_date <= $2::date
      ORDER BY price_date DESC
      LIMIT 1
      `,
      [securityId, asOfDate],
    );

    if ((result.rowCount ?? 0) === 0) {
      return null;
    }

    const row = result.rows[0];
    return {
      securityId: row.security_id,
      asOf: row.price_date.toISOString().slice(0, 10),
      price: Number(row.close_price),
      currency: row.currency,
    };
  }

  async getFxRate(fromCurrency: string, toCurrency: string, asOf: string): Promise<FxRate | null> {
    const asOfDate = asOf.slice(0, 10);
    const result = await this.pool.query<FxRateRow>(
      `
      SELECT from_currency, to_currency, price_date, rate
      FROM fx_rates
      WHERE from_currency = $1 AND to_currency = $2 AND price_date <= $3::date
      ORDER BY price_date DESC
      LIMIT 1
      `,
      [fromCurrency, toCurrency, asOfDate],
    );

    if ((result.rowCount ?? 0) === 0) {
      return null;
    }

    const row = result.rows[0];
    return {
      fromCurrency: row.from_currency,
      toCurrency: row.to_currency,
      asOf: row.price_date.toISOString().slice(0, 10),
      rate: Number(row.rate),
    };
  }

  async upsertSecurityPricesWithStaleGuard(
    source: string,
    records: SecurityPriceIngestRecord[],
  ): Promise<IngestionWriteSummary> {
    let ingested = 0;

    for (const record of records) {
      const result = await this.pool.query<{ ingested: boolean }>(
        `
        WITH latest AS (
          SELECT MAX(price_date) AS latest_date
          FROM security_prices
          WHERE security_id = $1
        ), upserted AS (
          INSERT INTO security_prices (security_id, price_date, close_price, currency, source)
          SELECT $1, $2::date, $3::numeric(24, 8), $4, $5
          WHERE COALESCE((SELECT latest_date FROM latest), $2::date) <= $2::date
          ON CONFLICT (security_id, price_date, source)
          DO UPDATE SET close_price = EXCLUDED.close_price, currency = EXCLUDED.currency
          RETURNING 1
        )
        SELECT EXISTS(SELECT 1 FROM upserted) AS ingested
        `,
        [record.securityId, record.asOfDate, record.price, record.currency, source],
      );

      if (result.rows[0]?.ingested) {
        ingested += 1;
      }
    }

    return {
      processed: records.length,
      ingested,
      skippedStale: records.length - ingested,
    };
  }

  async upsertFxRatesWithStaleGuard(
    source: string,
    records: FxRateIngestRecord[],
  ): Promise<IngestionWriteSummary> {
    let ingested = 0;

    for (const record of records) {
      const result = await this.pool.query<{ ingested: boolean }>(
        `
        WITH latest AS (
          SELECT MAX(price_date) AS latest_date
          FROM fx_rates
          WHERE from_currency = $1 AND to_currency = $2
        ), upserted AS (
          INSERT INTO fx_rates (price_date, from_currency, to_currency, rate, source)
          SELECT $3::date, $1, $2, $4::numeric(20, 10), $5
          WHERE COALESCE((SELECT latest_date FROM latest), $3::date) <= $3::date
          ON CONFLICT (price_date, from_currency, to_currency, source)
          DO UPDATE SET rate = EXCLUDED.rate
          RETURNING 1
        )
        SELECT EXISTS(SELECT 1 FROM upserted) AS ingested
        `,
        [record.fromCurrency, record.toCurrency, record.asOfDate, record.rate, source],
      );

      if (result.rows[0]?.ingested) {
        ingested += 1;
      }
    }

    return {
      processed: records.length,
      ingested,
      skippedStale: records.length - ingested,
    };
  }

  async getSecurityPriceFreshnessStatus(
    asOfDate: string,
    maxAgeHours: number,
  ): Promise<FreshnessStatus> {
    const thresholdDate = this.computeThresholdDate(asOfDate, maxAgeHours);
    const result = await this.pool.query<{ stale_count: string }>(
      `
      WITH latest_security_prices AS (
        SELECT security_id, MAX(price_date) AS latest_price_date
        FROM security_prices
        GROUP BY security_id
      )
      SELECT COUNT(*)::text AS stale_count
      FROM securities s
      LEFT JOIN latest_security_prices lp ON lp.security_id = s.id
      WHERE lp.latest_price_date IS NULL OR lp.latest_price_date < $1::date
      `,
      [thresholdDate],
    );

    return {
      staleCount: Number(result.rows[0]?.stale_count ?? 0),
      thresholdDate,
    };
  }

  async getFxRateFreshnessStatus(
    asOfDate: string,
    maxAgeHours: number,
    requiredPairs: Array<{ fromCurrency: string; toCurrency: string }>,
  ): Promise<FreshnessStatus> {
    const thresholdDate = this.computeThresholdDate(asOfDate, maxAgeHours);
    let staleCount = 0;

    for (const pair of requiredPairs) {
      const result = await this.pool.query<{ latest_rate_date: Date | null }>(
        `
        SELECT MAX(price_date) AS latest_rate_date
        FROM fx_rates
        WHERE from_currency = $1 AND to_currency = $2
        `,
        [pair.fromCurrency, pair.toCurrency],
      );

      const latest = result.rows[0]?.latest_rate_date;
      if (!latest || latest.toISOString().slice(0, 10) < thresholdDate) {
        staleCount += 1;
      }
    }

    return {
      staleCount,
      thresholdDate,
    };
  }

  private computeThresholdDate(asOfDate: string, maxAgeHours: number): string {
    const asOf = new Date(`${asOfDate}T00:00:00.000Z`);
    const threshold = new Date(asOf.getTime() - maxAgeHours * 60 * 60 * 1000);
    return threshold.toISOString().slice(0, 10);
  }
}
