import assert from "node:assert/strict";
import { InMemoryIdempotencyStore } from "../../adapters/in-memory-idempotency-store";
import { InMemoryTradeRepository } from "../../adapters/in-memory-trade-repository";
import {
  IdempotencyPayloadMismatchError,
  TradeRegistryService,
} from "./trade-registry-service";

const basePayload = {
  portfolioId: "00000000-0000-4000-8000-000000000001",
  securityId: "00000000-0000-4000-8000-000000000002",
  side: "BUY" as const,
  quantity: 10,
  price: 101.25,
  tradeDate: "2026-01-15T00:00:00.000Z",
  currency: "USD",
};

async function run() {
  const service = new TradeRegistryService(
    new InMemoryTradeRepository(),
    new InMemoryIdempotencyStore(),
    24,
  );

  const first = await service.registerTrade({
    idempotencyKey: "phase2-step4-sequential",
    ...basePayload,
  });

  const replay = await service.registerTrade({
    idempotencyKey: "phase2-step4-sequential",
    ...basePayload,
  });

  assert.equal(
    first.id,
    replay.id,
    "Replay with same key/payload must return the same trade id",
  );

  await assert.rejects(
    () =>
      service.registerTrade({
        idempotencyKey: "phase2-step4-sequential",
        ...basePayload,
        price: 102.5,
      }),
    (error: unknown) => error instanceof IdempotencyPayloadMismatchError,
    "Same key with a different payload must be rejected",
  );

  const concurrentResults = await Promise.all(
    Array.from({ length: 5 }).map(() =>
      service.registerTrade({
        idempotencyKey: "phase2-step4-concurrent",
        ...basePayload,
      }),
    ),
  );

  const uniqueTradeIds = new Set(concurrentResults.map((trade) => trade.id));
  assert.equal(
    uniqueTradeIds.size,
    1,
    "Concurrent duplicate requests must collapse to one trade id",
  );

  console.log("idempotency-smoke: ok");
  console.log(`sequentialTradeId=${first.id}`);
  console.log(`concurrentTradeId=${concurrentResults[0].id}`);
}

run().catch((error) => {
  console.error("idempotency-smoke: failed", error);
  process.exitCode = 1;
});
