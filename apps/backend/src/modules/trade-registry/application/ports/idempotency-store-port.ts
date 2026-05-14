export interface IdempotencyStorePort {
  exists(scope: string, key: string): Promise<boolean>;
  mark(scope: string, key: string): Promise<void>;
}
