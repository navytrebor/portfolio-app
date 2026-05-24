import type { TradeRecord } from "../domain/trade-record";
import type { TradeRepositoryPort } from "../application/ports/trade-repository-port";

export class InMemoryTradeRepository implements TradeRepositoryPort {
  private readonly items: TradeRecord[] = [];

  async create(trade: TradeRecord): Promise<TradeRecord> {
    const existing = this.items.find((item) => item.id === trade.id);
    if (existing) {
      return existing;
    }

    this.items.push(trade);
    return trade;
  }

  async findById(id: string): Promise<TradeRecord | null> {
    return this.items.find((item) => item.id === id) ?? null;
  }

  async list(): Promise<TradeRecord[]> {
    return [...this.items];
  }

  async listByPortfolioIds(portfolioIds: string[]): Promise<TradeRecord[]> {
    const allowed = new Set(portfolioIds);
    return this.items.filter((item) => allowed.has(item.portfolioId));
  }
}
