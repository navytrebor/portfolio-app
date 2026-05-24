import type { Pool } from "pg";
import type { IdempotencyStorePort } from "../application/ports/idempotency-store-port";

type IdempotencyRow = {
  effective_trade_id: string;
  request_hash: string | null;
  processing_status: "IN_PROGRESS" | "COMPLETED";
};

export class PostgresIdempotencyStore implements IdempotencyStorePort {
  constructor(private readonly pool: Pool) {}

  async reserveOrGet(
    scope: string,
    key: string,
    requestHash: string,
    proposedTradeId: string,
    expiresAt: string,
  ) {
    await this.pool.query(
      `
      INSERT INTO trade_idempotency_keys (
        scope,
        idempotency_key,
        reserved_trade_id,
        request_hash,
        processing_status,
        expires_at
      )
      VALUES ($1, $2, $3::uuid, $4, 'IN_PROGRESS', $5::timestamptz)
      ON CONFLICT (scope, idempotency_key) DO NOTHING
      `,
      [scope, key, proposedTradeId, requestHash, expiresAt],
    );

    const existing = await this.pool.query<IdempotencyRow>(
      `
      SELECT
        COALESCE(trade_id, reserved_trade_id) AS effective_trade_id,
        request_hash,
        processing_status
      FROM trade_idempotency_keys
      WHERE scope = $1 AND idempotency_key = $2
      `,
      [scope, key],
    );

    if ((existing.rowCount ?? 0) === 0) {
      throw new Error("Unable to load idempotency reservation");
    }

    const row = existing.rows[0];
    return {
      tradeId: row.effective_trade_id,
      requestHash: row.request_hash,
      status: row.processing_status,
    };
  }

  async markCompleted(scope: string, key: string, tradeId: string): Promise<void> {
    await this.pool.query(
      `
      UPDATE trade_idempotency_keys
      SET trade_id = $3,
          processing_status = 'COMPLETED',
          completed_at = NOW()
      WHERE scope = $1 AND idempotency_key = $2
      `,
      [scope, key, tradeId],
    );
  }
}
