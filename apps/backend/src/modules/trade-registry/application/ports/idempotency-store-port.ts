export interface IdempotencyStorePort {
  reserve(scope: string, key: string, expiresAt: string): Promise<boolean>;
  markCompleted(scope: string, key: string, tradeId: string): Promise<void>;
}
