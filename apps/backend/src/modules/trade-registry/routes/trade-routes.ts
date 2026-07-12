import type { FastifyInstance } from "fastify";
import { createTradeRequestSchema } from "@portfolio/contracts";
import type { IdentityService } from "../../identity/services/identity-service";
import type { PortfolioService } from "../../portfolio/services/portfolio-service";
import { rolePolicies } from "../../../auth/authorization-policies";
import type { TradeRegistryService } from "../application/services/trade-registry-service";
import { IdempotencyPayloadMismatchError } from "../application/services/trade-registry-service";
import { requireRole } from "../../../auth/request-auth";
import { apiV1Path } from "../../../http/api-versioning";
import { badRequest, conflict, forbidden, sendApiError } from "../../../http/api-errors";
import { paginateItems, parsePaginationQuery } from "../../../http/pagination";
import { parseTradeFilters } from "../../../http/query-filters";

export async function registerTradeRoutes(
  app: FastifyInstance,
  tradeRegistryService: TradeRegistryService,
  portfolioService: PortfolioService,
  identityService: IdentityService,
) {
  app.get(apiV1Path("/trades"), async (request, reply) => {
    const context = await requireRole(
      request,
      reply,
      identityService,
      rolePolicies.tradesRead,
    );
    if (!context) {
      return;
    }

    const pagination = parsePaginationQuery(request.query);
    const filters = parseTradeFilters(request.query);
    const portfolioIds = (await portfolioService.listUserPortfolios(context.userId)).map(
      (portfolio) => portfolio.id,
    );
    const items =
      context.role === "ADMIN"
        ? await tradeRegistryService.listTrades()
        : await tradeRegistryService.listTradesByPortfolioIds(portfolioIds);

    if (filters.portfolioId) {
      const allowedPortfolioIds = new Set(context.role === "ADMIN" ? items.map((item) => item.portfolioId) : portfolioIds);
      if (!allowedPortfolioIds.has(filters.portfolioId)) {
        return sendApiError(reply, request.id, forbidden("Portfolio access denied"));
      }
    }

    const filteredItems = filters.portfolioId
      ? items.filter((item) => item.portfolioId === filters.portfolioId)
      : items;

    return paginateItems(filteredItems, pagination);
  });

  app.post(apiV1Path("/trades"), async (request, reply) => {
    const context = await requireRole(request, reply, identityService, rolePolicies.tradesWrite);
    if (!context) {
      return;
    }

    const parsed = createTradeRequestSchema.safeParse(request.body);

    if (!parsed.success) {
      return sendApiError(reply, request.id, badRequest("Invalid trade payload", parsed.error.issues));
    }

    if (context.role !== "ADMIN") {
      const portfolios = await portfolioService.listUserPortfolios(context.userId);
      const hasAccess = portfolios.some((portfolio) => portfolio.id === parsed.data.portfolioId);
      if (!hasAccess) {
        return sendApiError(reply, request.id, forbidden("Portfolio access denied"));
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
        return sendApiError(
          reply,
          request.id,
          conflict("Idempotency key already used with different payload"),
        );
      }

      if (error instanceof Error && error.message === "Duplicate idempotency key") {
        return sendApiError(reply, request.id, conflict("Duplicate idempotency key"));
      }

      throw error;
    }
  });
}
