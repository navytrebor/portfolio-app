import type { TradeRecord } from "../../domain/trade-record";

export interface TradeRepositoryPort {
  create(trade: TradeRecord): Promise<TradeRecord>;
  list(): Promise<TradeRecord[]>;
}
