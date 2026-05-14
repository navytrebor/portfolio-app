import type { IdempotencyStorePort } from "../application/ports/idempotency-store-port";

export class InMemoryIdempotencyStore implements IdempotencyStorePort {
  private readonly keys = new Set<string>();

  async exists(scope: string, key: string): Promise<boolean> {
    return this.keys.has(`${scope}:${key}`);
  }

  async mark(scope: string, key: string): Promise<void> {
    this.keys.add(`${scope}:${key}`);
  }
}
