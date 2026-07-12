import type { Pool } from "pg";
import type { SecurityRepository } from "../repositories/security-repository";
import type { Security } from "../domain/security";

type SecurityRow = {
  id: string;
  ticker: string;
  security_type: string;
  currency: string;
};

function rowToSecurity(row: SecurityRow): Security {
  return {
    id: row.id,
    ticker: row.ticker,
    securityType: row.security_type,
    currency: row.currency,
  };
}

export class PostgresSecurityRepository implements SecurityRepository {
  constructor(private readonly pool: Pool) {}

  async listAll(): Promise<Security[]> {
    const result = await this.pool.query<SecurityRow>(
      `
      SELECT id, ticker, security_type, currency
      FROM securities
      ORDER BY ticker ASC
      `,
    );

    return result.rows.map(rowToSecurity);
  }

  async findById(id: string): Promise<Security | null> {
    const result = await this.pool.query<SecurityRow>(
      `
      SELECT id, ticker, security_type, currency
      FROM securities
      WHERE id = $1
      `,
      [id],
    );

    if ((result.rowCount ?? 0) === 0) {
      return null;
    }

    return rowToSecurity(result.rows[0]);
  }
}
