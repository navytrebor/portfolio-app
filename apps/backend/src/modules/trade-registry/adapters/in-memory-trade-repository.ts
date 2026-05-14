import type { TradeRecord } from "../domain/trade-record";
import type { TradeRepositoryPort } from "../application/ports/trade-repository-port";

export class InMemoryTradeRepository implements TradeRepositoryPort {
  private readonly items: TradeRecord[] = [];

  async create(trade: TradeRecord): Promise<TradeRecord> {
    this.items.push(trade);
    return trade;
  }

  async list(): Promise<TradeRecord[]> {
    return [...this.items];
  }
}
