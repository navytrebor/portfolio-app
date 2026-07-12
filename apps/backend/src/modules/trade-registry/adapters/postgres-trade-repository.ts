import type { Pool } from "pg";
import type { TradeRepositoryPort } from "../application/ports/trade-repository-port";
import type { TradeRecord } from "../domain/trade-record";

type TradeRow = {
  id: string;
  portfolio_id: string;
  security_id: string;
  side: "BUY" | "SELL";
  quantity: string;
  price: string;
  trade_date: Date;
  currency: string;
  created_at: Date;
};

function rowToTrade(row: TradeRow): TradeRecord {
  return {
    id: row.id,
    portfolioId: row.portfolio_id,
    securityId: row.security_id,
    side: row.side,
    quantity: Number(row.quantity),
    price: Number(row.price),
    tradeDate: row.trade_date.toISOString(),
    currency: row.currency,
    createdAt: row.created_at.toISOString(),
  };
}

export class PostgresTradeRepository implements TradeRepositoryPort {
  constructor(private readonly pool: Pool) {}

  async create(trade: TradeRecord): Promise<TradeRecord> {
    const result = await this.pool.query<TradeRow>(
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
        created_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7::timestamptz, $8, $9::timestamptz)
      ON CONFLICT (id) DO NOTHING
      RETURNING id, portfolio_id, security_id, side, quantity, price, trade_date, currency, created_at
      `,
      [
        trade.id,
        trade.portfolioId,
        trade.securityId,
        trade.side,
        trade.quantity,
        trade.price,
        trade.tradeDate,
        trade.currency,
        trade.createdAt,
      ],
    );

    if ((result.rowCount ?? 0) === 0) {
      const existing = await this.findById(trade.id);
      if (!existing) {
        throw new Error("Trade insert conflict without existing row");
      }

      return existing;
    }

    return rowToTrade(result.rows[0]);
  }

  async findById(id: string): Promise<TradeRecord | null> {
    const result = await this.pool.query<TradeRow>(
      `
      SELECT id, portfolio_id, security_id, side, quantity, price, trade_date, currency, created_at
      FROM trades
      WHERE id = $1
      `,
      [id],
    );

    if ((result.rowCount ?? 0) === 0) {
      return null;
    }

    return rowToTrade(result.rows[0]);
  }

  async list(): Promise<TradeRecord[]> {
    const result = await this.pool.query<TradeRow>(
      `
      SELECT id, portfolio_id, security_id, side, quantity, price, trade_date, currency, created_at
      FROM trades
      ORDER BY trade_date DESC, created_at DESC
      LIMIT 500
      `,
    );

    return result.rows.map(rowToTrade);
  }

  async listByPortfolioIds(portfolioIds: string[]): Promise<TradeRecord[]> {
    if (portfolioIds.length === 0) {
      return [];
    }

    const result = await this.pool.query<TradeRow>(
      `
      SELECT id, portfolio_id, security_id, side, quantity, price, trade_date, currency, created_at
      FROM trades
      WHERE portfolio_id = ANY($1::uuid[])
      ORDER BY trade_date DESC, created_at DESC
      LIMIT 500
      `,
      [portfolioIds],
    );

    return result.rows.map(rowToTrade);
  }

  async listForPortfolioAsOf(portfolioId: string, asOf: string): Promise<TradeRecord[]> {
    const result = await this.pool.query<TradeRow>(
      `
      SELECT id, portfolio_id, security_id, side, quantity, price, trade_date, currency, created_at
      FROM trades
      WHERE portfolio_id = $1
        AND trade_date <= $2::timestamptz
      ORDER BY trade_date ASC, created_at ASC, id ASC
      `,
      [portfolioId, asOf],
    );

    return result.rows.map(rowToTrade);
  }
}
