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
      ORDER BY price_date DESC, created_at DESC, source DESC
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
      ORDER BY price_date DESC, created_at DESC, source DESC
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
    if (records.length === 0) {
      return { processed: 0, ingested: 0, skippedStale: 0 };
    }

    const payload = records.map((record, index) => ({
      security_id: record.securityId,
      as_of_date: record.asOfDate,
      price: record.price,
      currency: record.currency,
      ordinal: index,
    }));
    const result = await this.pool.query<{ ingested_count: string }>(
      `
      WITH incoming AS (
        SELECT
          security_id,
          as_of_date::date AS as_of_date,
          price::numeric(24, 8) AS price,
          currency,
          ordinal
        FROM json_to_recordset($1::json) AS x(
          security_id text,
          as_of_date text,
          price numeric,
          currency text,
          ordinal int
        )
      ),
      deduped AS (
        SELECT DISTINCT ON (security_id, as_of_date)
          security_id,
          as_of_date,
          price,
          currency
        FROM incoming
        ORDER BY security_id, as_of_date, ordinal DESC
      ),
      latest_existing AS (
        SELECT security_id::text AS security_id, MAX(price_date) AS latest_date
        FROM security_prices
        GROUP BY security_id
      ),
      eligible AS (
        SELECT d.security_id, d.as_of_date, d.price, d.currency
        FROM deduped d
        LEFT JOIN latest_existing l ON l.security_id = d.security_id
        WHERE COALESCE(l.latest_date, d.as_of_date) <= d.as_of_date
      ),
      upserted AS (
        INSERT INTO security_prices (security_id, price_date, close_price, currency, source)
        SELECT
          security_id::uuid,
          as_of_date,
          price,
          currency,
          $2
        FROM eligible
        ON CONFLICT (security_id, price_date, source)
        DO UPDATE SET close_price = EXCLUDED.close_price, currency = EXCLUDED.currency
        RETURNING 1
      )
      SELECT COUNT(*)::text AS ingested_count
      FROM upserted
      `,
      [JSON.stringify(payload), source],
    );
    const ingested = Number(result.rows[0]?.ingested_count ?? 0);

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
    if (records.length === 0) {
      return { processed: 0, ingested: 0, skippedStale: 0 };
    }

    const payload = records.map((record, index) => ({
      from_currency: record.fromCurrency,
      to_currency: record.toCurrency,
      as_of_date: record.asOfDate,
      rate: record.rate,
      ordinal: index,
    }));
    const result = await this.pool.query<{ ingested_count: string }>(
      `
      WITH incoming AS (
        SELECT
          from_currency,
          to_currency,
          as_of_date::date AS as_of_date,
          rate::numeric(20, 10) AS rate,
          ordinal
        FROM json_to_recordset($1::json) AS x(
          from_currency text,
          to_currency text,
          as_of_date text,
          rate numeric,
          ordinal int
        )
      ),
      deduped AS (
        SELECT DISTINCT ON (from_currency, to_currency, as_of_date)
          from_currency,
          to_currency,
          as_of_date,
          rate
        FROM incoming
        ORDER BY from_currency, to_currency, as_of_date, ordinal DESC
      ),
      latest_existing AS (
        SELECT
          from_currency,
          to_currency,
          MAX(price_date) AS latest_date
        FROM fx_rates
        GROUP BY from_currency, to_currency
      ),
      eligible AS (
        SELECT d.from_currency, d.to_currency, d.as_of_date, d.rate
        FROM deduped d
        LEFT JOIN latest_existing l
          ON l.from_currency = d.from_currency AND l.to_currency = d.to_currency
        WHERE COALESCE(l.latest_date, d.as_of_date) <= d.as_of_date
      ),
      upserted AS (
        INSERT INTO fx_rates (price_date, from_currency, to_currency, rate, source)
        SELECT as_of_date, from_currency, to_currency, rate, $2
        FROM eligible
        ON CONFLICT (price_date, from_currency, to_currency, source)
        DO UPDATE SET rate = EXCLUDED.rate
        RETURNING 1
      )
      SELECT COUNT(*)::text AS ingested_count
      FROM upserted
      `,
      [JSON.stringify(payload), source],
    );
    const ingested = Number(result.rows[0]?.ingested_count ?? 0);

    return {
      processed: records.length,
      ingested,
      skippedStale: records.length - ingested,
    };
  }

  async getSecurityPriceFreshnessStatus(
    asOfDate: string,
    maxAgeHours: number,
    requiredSecurityIds: string[],
  ): Promise<FreshnessStatus> {
    const thresholdTimestamp = this.computeThresholdTimestamp(asOfDate, maxAgeHours);
    if (requiredSecurityIds.length === 0) {
      return {
        staleCount: 0,
        thresholdDate: thresholdTimestamp.toISOString(),
      };
    }

    const result = await this.pool.query<{ stale_count: string }>(
      `
      WITH required_security_ids AS (
        SELECT UNNEST($2::text[]) AS security_id
      ),
      latest_security_prices AS (
        SELECT security_id::text AS security_id, MAX(price_date) AS latest_price_date
        FROM security_prices
        WHERE security_id::text = ANY($2::text[])
        GROUP BY security_id
      )
      SELECT COUNT(*)::text AS stale_count
      FROM required_security_ids r
      LEFT JOIN latest_security_prices lp ON lp.security_id = r.security_id
      WHERE lp.latest_price_date IS NULL
        OR (lp.latest_price_date::timestamp + INTERVAL '1 day' - INTERVAL '1 millisecond') < $1::timestamptz
      `,
      [thresholdTimestamp.toISOString(), requiredSecurityIds],
    );

    return {
      staleCount: Number(result.rows[0]?.stale_count ?? 0),
      thresholdDate: thresholdTimestamp.toISOString(),
    };
  }

  async getFxRateFreshnessStatus(
    asOfDate: string,
    maxAgeHours: number,
    requiredPairs: Array<{ fromCurrency: string; toCurrency: string }>,
  ): Promise<FreshnessStatus> {
    const thresholdTimestamp = this.computeThresholdTimestamp(asOfDate, maxAgeHours);
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
      if (
        !latest ||
        this.toEndOfDayTimestamp(latest.toISOString().slice(0, 10)).getTime() <
          thresholdTimestamp.getTime()
      ) {
        staleCount += 1;
      }
    }

    return {
      staleCount,
      thresholdDate: thresholdTimestamp.toISOString(),
    };
  }

  private computeThresholdTimestamp(asOfDate: string, maxAgeHours: number): Date {
    const asOf = this.toEndOfDayTimestamp(asOfDate);
    return new Date(asOf.getTime() - maxAgeHours * 60 * 60 * 1000);
  }

  private toEndOfDayTimestamp(value: string): Date {
    return new Date(`${value}T23:59:59.999Z`);
  }
}
