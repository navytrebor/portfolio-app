export interface IdempotencyStorePort {
  reserve(scope: string, key: string, expiresAt: string): Promise<boolean>;
  markCompleted(scope: string, key: string, tradeId: string): Promise<void>;
  release(scope: string, key: string): Promise<void>;
}
