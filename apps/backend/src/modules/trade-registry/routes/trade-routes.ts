import type { FastifyInstance } from "fastify";
import { createTradeRequestSchema } from "@portfolio/contracts";
import type { IdentityService } from "../../identity/services/identity-service";
import type { PortfolioService } from "../../portfolio/services/portfolio-service";
import { rolePolicies } from "../../../auth/authorization-policies";
import type { TradeRegistryService } from "../application/services/trade-registry-service";
import { IdempotencyPayloadMismatchError } from "../application/services/trade-registry-service";
import { requireRole } from "../../../auth/request-auth";

export async function registerTradeRoutes(
  app: FastifyInstance,
  tradeRegistryService: TradeRegistryService,
  portfolioService: PortfolioService,
  identityService: IdentityService,
) {
  app.get("/api/trades", async (request, reply) => {
    const context = await requireRole(
      request,
      reply,
      identityService,
      rolePolicies.tradesRead,
    );
    if (!context) {
      return;
    }

    const portfolioIds = (await portfolioService.listUserPortfolios(context.userId)).map(
      (portfolio) => portfolio.id,
    );
    const items =
      context.role === "ADMIN"
        ? await tradeRegistryService.listTrades()
        : await tradeRegistryService.listTradesByPortfolioIds(portfolioIds);
    return { items };
  });

  app.post("/api/trades", async (request, reply) => {
    const context = await requireRole(request, reply, identityService, rolePolicies.tradesWrite);
    if (!context) {
      return;
    }

    const parsed = createTradeRequestSchema.safeParse(request.body);

    if (!parsed.success) {
      return reply.status(400).send({
        message: "Invalid trade payload",
        issues: parsed.error.issues,
      });
    }

    if (context.role !== "ADMIN") {
      const portfolios = await portfolioService.listUserPortfolios(context.userId);
      const hasAccess = portfolios.some((portfolio) => portfolio.id === parsed.data.portfolioId);
      if (!hasAccess) {
        return reply.status(403).send({ message: "Portfolio access denied" });
      }
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
