import type { TradeRecord } from "../../domain/trade-record";

export interface TradeRepositoryPort {
  create(trade: TradeRecord): Promise<TradeRecord>;
  findById(id: string): Promise<TradeRecord | null>;
  list(): Promise<TradeRecord[]>;
  listByPortfolioIds(portfolioIds: string[]): Promise<TradeRecord[]>;
}
