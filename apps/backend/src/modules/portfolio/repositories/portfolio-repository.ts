import type { Portfolio } from "../domain/portfolio";

export interface PortfolioRepository {
  findById(id: string): Promise<Portfolio | null>;
  listAll(): Promise<Portfolio[]>;
  listByUserId(userId: string): Promise<Portfolio[]>;
}
