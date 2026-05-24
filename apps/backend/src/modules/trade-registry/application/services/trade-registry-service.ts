import { createHash } from "node:crypto";
import type {
  RegisterTradeInput,
  TradeRecord,
} from "../../domain/trade-record";
import type { IdempotencyStorePort } from "../ports/idempotency-store-port";
import type { TradeRepositoryPort } from "../ports/trade-repository-port";

export class IdempotencyPayloadMismatchError extends Error {
  constructor() {
    super("Idempotency key already used with a different payload");
    this.name = "IdempotencyPayloadMismatchError";
  }
}

function hashTradeRequest(input: RegisterTradeInput): string {
  const canonicalPayload = JSON.stringify({
    portfolioId: input.portfolioId,
    securityId: input.securityId,
    side: input.side,
    quantity: input.quantity,
    price: input.price,
    tradeDate: input.tradeDate,
    currency: input.currency,
  });

  return createHash("sha256").update(canonicalPayload).digest("hex");
}

export class TradeRegistryService {
  constructor(
    private readonly trades: TradeRepositoryPort,
    private readonly idempotency: IdempotencyStorePort,
    private readonly idempotencyTtlHours: number,
  ) {}

  async listTrades(): Promise<TradeRecord[]> {
    return this.trades.list();
  }

  async registerTrade(input: RegisterTradeInput): Promise<TradeRecord> {
    const scope = "trade-registry.register";
    const expiresAt = new Date(
      Date.now() + this.idempotencyTtlHours * 60 * 60 * 1000,
    ).toISOString();
    const requestHash = hashTradeRequest(input);
    const proposedTradeId = crypto.randomUUID();

    const reservation = await this.idempotency.reserveOrGet(
      scope,
      input.idempotencyKey,
      requestHash,
      proposedTradeId,
      expiresAt,
    );

    if (
      reservation.requestHash !== null &&
      reservation.requestHash !== requestHash
    ) {
      throw new IdempotencyPayloadMismatchError();
    }

    const trade: TradeRecord = {
      id: reservation.tradeId,
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

    if (reservation.status !== "COMPLETED") {
      await this.idempotency.markCompleted(scope, input.idempotencyKey, created.id);
    }

    return created;
  }
}
