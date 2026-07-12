import type { Portfolio } from "../domain/portfolio";
import type { PortfolioRepository } from "../repositories/portfolio-repository";

export class InMemoryPortfolioRepository implements PortfolioRepository {
  private readonly items: Portfolio[] = [];

  async findById(id: string): Promise<Portfolio | null> {
    return this.items.find((portfolio) => portfolio.id === id) ?? null;
  }

  async listByUserId(userId: string): Promise<Portfolio[]> {
    return this.items.filter((portfolio) => portfolio.userId === userId);
  }
}
