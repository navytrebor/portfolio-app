import type { Pool } from "pg";
import { env } from "../../../config/env";
import type {
  BenchmarkComparisonPort,
  ConcentrationRiskIndicators,
  ConcentrationRiskPort,
  PerformanceMetricsRepositoryPort,
  ValuationHistoryPort,
} from "../application/ports/performance-ports";
import type { PerformanceMetrics } from "../domain/performance-metrics";
import type { ValuationSnapshot } from "../../valuation/domain/valuation";

type ValuationSnapshotRow = {
  portfolio_id: string;
  as_of: Date;
  securities_value: string;
  cash_value: string;
  total_value: string;
  currency: string;
};

type PositionSnapshotRow = {
  market_value: string;
  currency: string;
};

type BenchmarkSecurityRow = {
  id: string;
};

type BenchmarkPriceRow = {
  close_price: string;
  currency: string;
};

type FxRateRow = {
  rate: string;
};

export class PostgresValuationHistory implements ValuationHistoryPort {
  constructor(private readonly pool: Pool) {}

  async listSnapshots(portfolioId: string, asOf: string): Promise<ValuationSnapshot[]> {
    const result = await this.pool.query<ValuationSnapshotRow>(
      `
      SELECT portfolio_id, as_of, securities_value, cash_value, total_value, currency
      FROM valuation_snapshots
      WHERE portfolio_id = $1
        AND as_of <= $2::timestamptz
      ORDER BY as_of ASC
      `,
      [portfolioId, asOf],
    );

    return result.rows.map((row) => ({
      portfolioId: row.portfolio_id,
      asOf: row.as_of.toISOString(),
      securitiesValue: Number(row.securities_value),
      cashValue: Number(row.cash_value),
      totalValue: Number(row.total_value),
      currency: row.currency,
    }));
  }
}

export class PostgresBenchmarkComparison implements BenchmarkComparisonPort {
  constructor(private readonly pool: Pool) {}

  async computeBenchmarkReturn(
    baseCurrency: string,
    fromAsOf: string,
    toAsOf: string,
  ): Promise<number | null> {
    const security = await this.findBenchmarkSecurity();
    if (!security) {
      return null;
    }

    const startPrice = await this.findBenchmarkPrice(security.id, fromAsOf);
    const endPrice = await this.findBenchmarkPrice(security.id, toAsOf);
    if (!startPrice || !endPrice) {
      return null;
    }

    const startValue = await this.convertToBase(
      Number(startPrice.close_price),
      startPrice.currency,
      baseCurrency,
      fromAsOf,
    );
    const endValue = await this.convertToBase(
      Number(endPrice.close_price),
      endPrice.currency,
      baseCurrency,
      toAsOf,
    );

    if (startValue <= 0) {
      return null;
    }

    return endValue / startValue - 1;
  }

  private async findBenchmarkSecurity(): Promise<BenchmarkSecurityRow | null> {
    const result = await this.pool.query<BenchmarkSecurityRow>(
      `
      SELECT id
      FROM securities
      WHERE ticker = $1
      LIMIT 1
      `,
      [env.PERFORMANCE_BENCHMARK_TICKER],
    );

    if ((result.rowCount ?? 0) === 0) {
      return null;
    }

    return result.rows[0];
  }

  private async findBenchmarkPrice(
    securityId: string,
    asOf: string,
  ): Promise<BenchmarkPriceRow | null> {
    const result = await this.pool.query<BenchmarkPriceRow>(
      `
      SELECT close_price, currency
      FROM security_prices
      WHERE security_id = $1
        AND price_date <= $2::date
      ORDER BY price_date DESC, created_at DESC, source DESC
      LIMIT 1
      `,
      [securityId, asOf.slice(0, 10)],
    );

    if ((result.rowCount ?? 0) === 0) {
      return null;
    }

    return result.rows[0];
  }

  private async convertToBase(
    value: number,
    fromCurrency: string,
    toCurrency: string,
    asOf: string,
  ): Promise<number> {
    if (fromCurrency === toCurrency) {
      return value;
    }

    const rate = await this.findFxRate(fromCurrency, toCurrency, asOf);
    if (!rate) {
      throw new Error(
        `Missing FX rate for benchmark conversion ${fromCurrency}/${toCurrency} at ${asOf}`,
      );
    }

    return value * rate;
  }

  private async findFxRate(
    fromCurrency: string,
    toCurrency: string,
    asOf: string,
  ): Promise<number | null> {
    const result = await this.pool.query<FxRateRow>(
      `
      SELECT rate
      FROM fx_rates
      WHERE from_currency = $1
        AND to_currency = $2
        AND price_date <= $3::date
      ORDER BY price_date DESC, created_at DESC, source DESC
      LIMIT 1
      `,
      [fromCurrency, toCurrency, asOf.slice(0, 10)],
    );

    if ((result.rowCount ?? 0) === 0) {
      return null;
    }

    return Number(result.rows[0].rate);
  }
}

export class PostgresConcentrationRisk implements ConcentrationRiskPort {
  constructor(private readonly pool: Pool) {}

  async computeConcentrationRisk(
    portfolioId: string,
    asOf: string,
    baseCurrency: string,
    portfolioValue: number,
  ): Promise<ConcentrationRiskIndicators | null> {
    if (portfolioValue <= 0) {
      return null;
    }

    const snapshotAsOf = await this.findLatestPositionAsOf(portfolioId, asOf);
    if (!snapshotAsOf) {
      return null;
    }

    const positions = await this.pool.query<PositionSnapshotRow>(
      `
      SELECT market_value, currency
      FROM position_snapshots
      WHERE portfolio_id = $1
        AND as_of = $2::timestamptz
      `,
      [portfolioId, snapshotAsOf],
    );

    if ((positions.rowCount ?? 0) === 0) {
      return null;
    }

    const convertedValues: number[] = [];
    for (const position of positions.rows) {
      try {
        const converted = await this.convertToBase(
          Number(position.market_value),
          position.currency,
          baseCurrency,
          snapshotAsOf,
        );
        convertedValues.push(converted);
      } catch (error) {
        if (
          error instanceof Error &&
          error.message.startsWith("Missing FX rate for concentration conversion")
        ) {
          return null;
        }
        throw error;
      }
    }

    const weights = convertedValues
      .map((value) => value / portfolioValue)
      .filter((weight) => Number.isFinite(weight) && weight > 0);

    if (weights.length === 0) {
      return null;
    }

    const concentrationHhi = weights.reduce((acc, weight) => acc + weight * weight, 0);
    const topPositionWeight = Math.max(...weights);

    return {
      concentrationHhi,
      topPositionWeight,
    };
  }

  private async findLatestPositionAsOf(
    portfolioId: string,
    asOf: string,
  ): Promise<string | null> {
    const result = await this.pool.query<{ as_of: Date }>(
      `
      SELECT as_of
      FROM position_snapshots
      WHERE portfolio_id = $1
        AND as_of <= $2::timestamptz
      ORDER BY as_of DESC
      LIMIT 1
      `,
      [portfolioId, asOf],
    );

    if ((result.rowCount ?? 0) === 0) {
      return null;
    }

    return result.rows[0].as_of.toISOString();
  }

  private async convertToBase(
    value: number,
    fromCurrency: string,
    toCurrency: string,
    asOf: string,
  ): Promise<number> {
    if (fromCurrency === toCurrency) {
      return value;
    }

    const result = await this.pool.query<FxRateRow>(
      `
      SELECT rate
      FROM fx_rates
      WHERE from_currency = $1
        AND to_currency = $2
        AND price_date <= $3::date
      ORDER BY price_date DESC, created_at DESC, source DESC
      LIMIT 1
      `,
      [fromCurrency, toCurrency, asOf.slice(0, 10)],
    );

    if ((result.rowCount ?? 0) === 0) {
      throw new Error(
        `Missing FX rate for concentration conversion ${fromCurrency}/${toCurrency} at ${asOf}`,
      );
    }

    return value * Number(result.rows[0].rate);
  }
}

export class PostgresPerformanceMetricsRepository
  implements PerformanceMetricsRepositoryPort
{
  constructor(private readonly pool: Pool) {}

  async save(metrics: PerformanceMetrics): Promise<void> {
    await this.pool.query(
      `
      INSERT INTO performance_snapshots (
        portfolio_id,
        as_of,
        twr,
        mwr,
        drawdown,
        rolling_volatility,
        benchmark_return,
        benchmark_spread,
        concentration_hhi,
        top_position_weight
      )
      VALUES ($1, $2::timestamptz, $3, $4, $5, $6, $7, $8, $9, $10)
      ON CONFLICT (portfolio_id, as_of)
      DO UPDATE SET
        twr = EXCLUDED.twr,
        mwr = EXCLUDED.mwr,
        drawdown = EXCLUDED.drawdown,
        rolling_volatility = EXCLUDED.rolling_volatility,
        benchmark_return = EXCLUDED.benchmark_return,
        benchmark_spread = EXCLUDED.benchmark_spread,
        concentration_hhi = EXCLUDED.concentration_hhi,
        top_position_weight = EXCLUDED.top_position_weight
      `,
      [
        metrics.portfolioId,
        metrics.asOf,
        metrics.twr,
        metrics.mwr,
        metrics.drawdown,
        metrics.rollingVolatility,
        metrics.benchmarkReturn,
        metrics.benchmarkSpread,
        metrics.concentrationHhi,
        metrics.topPositionWeight,
      ],
    );
  }
}
