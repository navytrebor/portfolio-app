import type { Portfolio } from "../domain/portfolio";
import type { PortfolioRepository } from "../repositories/portfolio-repository";

export class PortfolioService {
  constructor(private readonly portfolios: PortfolioRepository) {}

  async getPortfolio(id: string): Promise<Portfolio | null> {
    return this.portfolios.findById(id);
  }

  async listUserPortfolios(userId: string): Promise<Portfolio[]> {
    return this.portfolios.listByUserId(userId);
  }
}
