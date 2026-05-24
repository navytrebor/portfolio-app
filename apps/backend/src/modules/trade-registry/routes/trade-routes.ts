import type { FastifyInstance } from "fastify";
import { createTradeRequestSchema } from "@portfolio/contracts";
import type { TradeRegistryService } from "../application/services/trade-registry-service";
import { IdempotencyPayloadMismatchError } from "../application/services/trade-registry-service";

export async function registerTradeRoutes(
  app: FastifyInstance,
  tradeRegistryService: TradeRegistryService,
) {
  app.get("/api/trades", async () => {
    const items = await tradeRegistryService.listTrades();
    return { items };
  });

  app.post("/api/trades", async (request, reply) => {
    const parsed = createTradeRequestSchema.safeParse(request.body);

    if (!parsed.success) {
      return reply.status(400).send({
        message: "Invalid trade payload",
        issues: parsed.error.issues,
      });
    }

    const idempotencyKey = request.headers["x-idempotency-key"];
    const normalizedKey =
      typeof idempotencyKey === "string" && idempotencyKey.trim().length > 0
        ? idempotencyKey.trim()
        : crypto.randomUUID();

    try {
      const trade = await tradeRegistryService.registerTrade({
        idempotencyKey: normalizedKey,
        ...parsed.data,
      });
      return reply.status(201).send(trade);
    } catch (error) {
      if (error instanceof IdempotencyPayloadMismatchError) {
        return reply.status(409).send({
          message: "Idempotency key already used with different payload",
        });
      }

      if (error instanceof Error && error.message === "Duplicate idempotency key") {
        return reply.status(409).send({
          message: "Duplicate idempotency key",
        });
      }

      return reply.status(500).send({ message: "Unable to register trade" });
    }
  });
}
