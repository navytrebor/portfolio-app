import type { Portfolio } from "../domain/portfolio";
import type { PortfolioRepository } from "../repositories/portfolio-repository";

export class PortfolioService {
  constructor(private readonly portfolios: PortfolioRepository) {}

  async listUserPortfolios(userId: string): Promise<Portfolio[]> {
    return this.portfolios.listByUserId(userId);
  }
}
