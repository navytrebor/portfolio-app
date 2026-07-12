import type { Security } from "../domain/security";
import type { SecurityRepository } from "../repositories/security-repository";

export class InMemorySecurityRepository implements SecurityRepository {
  private readonly byId = new Map<string, Security>();

  async listAll(): Promise<Security[]> {
    return Array.from(this.byId.values()).sort((left, right) =>
      left.ticker.localeCompare(right.ticker),
    );
  }

  async findById(id: string): Promise<Security | null> {
    return this.byId.get(id) ?? null;
  }
}
