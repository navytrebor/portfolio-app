import type { Portfolio } from "../domain/portfolio";
import type { PortfolioRepository } from "../repositories/portfolio-repository";

export class InMemoryPortfolioRepository implements PortfolioRepository {
  private readonly items: Portfolio[] = [];

  async listByUserId(userId: string): Promise<Portfolio[]> {
    return this.items.filter((portfolio) => portfolio.userId === userId);
  }
}
