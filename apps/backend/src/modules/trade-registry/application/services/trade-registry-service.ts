import type {
  RegisterTradeInput,
  TradeRecord,
} from "../../domain/trade-record";
import type { IdempotencyStorePort } from "../ports/idempotency-store-port";
import type { TradeRepositoryPort } from "../ports/trade-repository-port";

export class TradeRegistryService {
  constructor(
    private readonly trades: TradeRepositoryPort,
    private readonly idempotency: IdempotencyStorePort,
  ) {}

  async listTrades(): Promise<TradeRecord[]> {
    return this.trades.list();
  }

  async registerTrade(input: RegisterTradeInput): Promise<TradeRecord> {
    const scope = "trade-registry.register";
    const alreadyProcessed = await this.idempotency.exists(scope, input.idempotencyKey);

    if (alreadyProcessed) {
      throw new Error("Duplicate idempotency key");
    }

    const trade: TradeRecord = {
      id: crypto.randomUUID(),
      portfolioId: input.portfolioId,
      securityId: input.securityId,
      side: input.side,
      quantity: input.quantity,
      price: input.price,
      tradeDate: input.tradeDate,
      currency: input.currency,
      createdAt: new Date().toISOString(),
    };

    const created = await this.trades.create(trade);
    await this.idempotency.mark(scope, input.idempotencyKey);

    return created;
  }
}
