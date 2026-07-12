import type { Pool } from "pg";
import type { PortfolioRepository } from "../../portfolio/repositories/portfolio-repository";
import type { PricingFxRepository } from "../../pricing-fx/repositories/pricing-fx-repository";
import type { TradeRecord } from "../../trade-registry/domain/trade-record";
import type { TradeRepositoryPort } from "../../trade-registry/application/ports/trade-repository-port";
import type {
  PortfolioBaseCurrencyPort,
  PositionSourcePort,
  PriceSourcePort,
  ValuationSnapshotRepositoryPort,
} from "../application/ports/valuation-ports";
import type {
  PositionSnapshot,
  ReconstructedPosition,
  ValuationSnapshot,
} from "../domain/valuation";
import type { FxRate, SecurityPrice } from "../../pricing-fx/domain/market-data";

type PositionAccumulator = {
  securityId: string;
  quantity: number;
  totalCost: number;
  currency: string;
};

export class PortfolioBaseCurrencySource implements PortfolioBaseCurrencyPort {
  constructor(private readonly portfolios: PortfolioRepository) {}

  async getBaseCurrency(portfolioId: string): Promise<string | null> {
    const portfolio = await this.portfolios.findById(portfolioId);
    return portfolio?.baseCurrency ?? null;
  }
}

export class PricingFxMarketDataSource implements PriceSourcePort {
  constructor(private readonly pricingFx: PricingFxRepository) {}

  async getPrice(securityId: string, asOf: string): Promise<SecurityPrice | null> {
    return this.pricingFx.getSecurityPrice(securityId, asOf);
  }

  async getFxRate(fromCurrency: string, toCurrency: string, asOf: string): Promise<FxRate | null> {
    return this.pricingFx.getFxRate(fromCurrency, toCurrency, asOf);
  }
}

export class TradeLedgerPositionSource implements PositionSourcePort {
  constructor(private readonly trades: TradeRepositoryPort) {}

  async listPositions(portfolioId: string, asOf: string): Promise<ReconstructedPosition[]> {
    const tradeLedger = sortTradeLedger(
      await this.trades.listForPortfolioAsOf(portfolioId, asOf),
    );

    const bySecurity = new Map<string, PositionAccumulator>();

    for (const trade of tradeLedger) {
      const current = bySecurity.get(trade.securityId) ?? {
        securityId: trade.securityId,
        quantity: 0,
        totalCost: 0,
        currency: trade.currency,
      };

      if (trade.side === "BUY") {
        current.quantity += trade.quantity;
        current.totalCost += trade.quantity * trade.price;
      } else {
        if (current.quantity <= 0) {
          current.quantity = 0;
          current.totalCost = 0;
          bySecurity.set(trade.securityId, current);
          continue;
        }

        const averageCost = current.totalCost / current.quantity;
        if (trade.quantity >= current.quantity) {
          current.quantity = 0;
          current.totalCost = 0;
        } else {
          current.quantity -= trade.quantity;
          current.totalCost -= averageCost * trade.quantity;
        }
      }

      current.currency = trade.currency;
      bySecurity.set(trade.securityId, current);
    }

    return Array.from(bySecurity.values())
      .filter((position) => position.quantity > 0)
      .map((position) => ({
        portfolioId,
        securityId: position.securityId,
        quantity: position.quantity,
        averageCost:
          position.quantity > 0 ? position.totalCost / position.quantity : 0,
        currency: position.currency,
      }));
  }
}

export class PostgresValuationSnapshotRepository
  implements ValuationSnapshotRepositoryPort
{
  constructor(private readonly pool: Pool) {}

  async savePositions(positionSnapshots: PositionSnapshot[]): Promise<void> {
    if (positionSnapshots.length === 0) {
      return;
    }

    const portfolioId = positionSnapshots[0].portfolioId;
    const asOf = positionSnapshots[0].asOf;

    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");

      await client.query(
        `
        DELETE FROM position_snapshots
        WHERE portfolio_id = $1 AND as_of = $2::timestamptz
        `,
        [portfolioId, asOf],
      );

      for (const snapshot of positionSnapshots) {
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
            snapshot.portfolioId,
            snapshot.securityId,
            snapshot.asOf,
            snapshot.quantity,
            snapshot.averageCost,
            snapshot.marketValue,
            snapshot.currency,
          ],
        );
      }

      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  async saveValuationSnapshot(snapshot: ValuationSnapshot): Promise<void> {
    await this.pool.query(
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
        snapshot.portfolioId,
        snapshot.asOf,
        snapshot.securitiesValue,
        snapshot.cashValue,
        snapshot.totalValue,
        snapshot.currency,
      ],
    );
  }
}

function compareTrades(left: TradeRecord, right: TradeRecord): number {
  const byTradeDate = left.tradeDate.localeCompare(right.tradeDate);
  if (byTradeDate !== 0) {
    return byTradeDate;
  }

  const byCreatedAt = left.createdAt.localeCompare(right.createdAt);
  if (byCreatedAt !== 0) {
    return byCreatedAt;
  }

  return left.id.localeCompare(right.id);
}

export function sortTradeLedger(trades: TradeRecord[]): TradeRecord[] {
  return [...trades].sort(compareTrades);
}
