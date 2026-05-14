import type { IdempotencyStorePort } from "../application/ports/idempotency-store-port";

export class InMemoryIdempotencyStore implements IdempotencyStorePort {
  private readonly keys = new Map<string, { expiresAt: string; tradeId?: string }>();

  async reserve(scope: string, key: string, expiresAt: string): Promise<boolean> {
    const composite = `${scope}:${key}`;
    if (this.keys.has(composite)) {
      return false;
    }

    this.keys.set(composite, { expiresAt });
    return true;
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
    });
  }

  async release(scope: string, key: string): Promise<void> {
    const composite = `${scope}:${key}`;
    this.keys.delete(composite);
  }
}
