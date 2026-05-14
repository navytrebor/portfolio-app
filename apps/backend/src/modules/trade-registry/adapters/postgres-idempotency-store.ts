import type { Pool } from "pg";
import type { IdempotencyStorePort } from "../application/ports/idempotency-store-port";

export class PostgresIdempotencyStore implements IdempotencyStorePort {
  constructor(private readonly pool: Pool) {}

  async reserve(scope: string, key: string, expiresAt: string): Promise<boolean> {
    const result = await this.pool.query(
      `
      INSERT INTO trade_idempotency_keys (scope, idempotency_key, expires_at)
      VALUES ($1, $2, $3::timestamptz)
      ON CONFLICT (scope, idempotency_key) DO NOTHING
      RETURNING scope
      `,
      [scope, key, expiresAt],
    );

    return (result.rowCount ?? 0) > 0;
  }

  async markCompleted(scope: string, key: string, tradeId: string): Promise<void> {
    await this.pool.query(
      `
      UPDATE trade_idempotency_keys
      SET trade_id = $3
      WHERE scope = $1 AND idempotency_key = $2
      `,
      [scope, key, tradeId],
    );
  }
}
