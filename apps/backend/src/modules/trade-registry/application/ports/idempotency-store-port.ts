export type IdempotencyStatus = "IN_PROGRESS" | "COMPLETED";

export type IdempotencyReservation = {
  tradeId: string;
  requestHash: string | null;
  status: IdempotencyStatus;
};

export interface IdempotencyStorePort {
  reserveOrGet(
    scope: string,
    key: string,
    requestHash: string,
    proposedTradeId: string,
    expiresAt: string,
  ): Promise<IdempotencyReservation>;
  markCompleted(scope: string, key: string, tradeId: string): Promise<void>;
}
