import type { Pool } from "pg";
import type { PortfolioRepository } from "../repositories/portfolio-repository";
import type { Portfolio } from "../domain/portfolio";

type PortfolioRow = {
  id: string;
  user_id: string;
  name: string;
  base_currency: string;
};

function rowToPortfolio(row: PortfolioRow): Portfolio {
  return {
    id: row.id,
    userId: row.user_id,
    name: row.name,
    baseCurrency: row.base_currency,
  };
}

export class PostgresPortfolioRepository implements PortfolioRepository {
  constructor(private readonly pool: Pool) {}

  async listAll(): Promise<Portfolio[]> {
    const result = await this.pool.query<PortfolioRow>(
      `
      SELECT id, user_id, name, base_currency
      FROM portfolios
      ORDER BY created_at ASC
      `,
    );

    return result.rows.map(rowToPortfolio);
  }

  async findById(id: string): Promise<Portfolio | null> {
    const result = await this.pool.query<PortfolioRow>(
      `
      SELECT id, user_id, name, base_currency
      FROM portfolios
      WHERE id = $1
      `,
      [id],
    );

    if ((result.rowCount ?? 0) === 0) {
      return null;
    }

    return rowToPortfolio(result.rows[0]);
  }

  async listByUserId(userId: string): Promise<Portfolio[]> {
    const result = await this.pool.query<PortfolioRow>(
      `
      SELECT id, user_id, name, base_currency
      FROM portfolios
      WHERE user_id = $1
      ORDER BY name ASC
      `,
      [userId],
    );

    return result.rows.map(rowToPortfolio);
  }
}
