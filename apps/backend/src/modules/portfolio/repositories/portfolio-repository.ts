import type { Portfolio } from "../domain/portfolio";

export interface PortfolioRepository {
  listByUserId(userId: string): Promise<Portfolio[]>;
}
