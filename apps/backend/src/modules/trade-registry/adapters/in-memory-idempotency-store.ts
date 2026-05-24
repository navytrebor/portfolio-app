import type {
  IdempotencyReservation,
  IdempotencyStorePort,
} from "../application/ports/idempotency-store-port";

export class InMemoryIdempotencyStore implements IdempotencyStorePort {
  private readonly keys = new Map<
    string,
    {
      expiresAt: string;
      tradeId: string;
      requestHash: string;
      status: "IN_PROGRESS" | "COMPLETED";
    }
  >();

  async reserveOrGet(
    scope: string,
    key: string,
    requestHash: string,
    proposedTradeId: string,
    expiresAt: string,
  ): Promise<IdempotencyReservation> {
    const composite = `${scope}:${key}`;
    const existing = this.keys.get(composite);
    if (existing) {
      return {
        tradeId: existing.tradeId,
        requestHash: existing.requestHash,
        status: existing.status,
      };
    }

    this.keys.set(composite, {
      expiresAt,
      tradeId: proposedTradeId,
      requestHash,
      status: "IN_PROGRESS",
    });

    return {
      tradeId: proposedTradeId,
      requestHash,
      status: "IN_PROGRESS",
    };
  }

  async markCompleted(scope: string, key: string, tradeId: string): Promise<void> {
    const composite = `${scope}:${key}`;
    const entry = this.keys.get(composite);
    if (!entry) {
      return;
    }

    this.keys.set(composite, {
      ...entry,
      tradeId,
      status: "COMPLETED",
    });
  }
}
