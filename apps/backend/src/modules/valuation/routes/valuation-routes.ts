import type { FastifyInstance } from "fastify";
import { z } from "zod";
import type { ValuationService } from "../application/services/valuation-service";
import { requireRole } from "../../../auth/request-auth";

const runValuationSchema = z.object({
  portfolioId: z.string().uuid(),
  asOf: z.string().datetime(),
});

export async function registerValuationRoutes(
  app: FastifyInstance,
  valuationService: ValuationService,
) {
  app.post("/api/valuations/run", async (request, reply) => {
    if (!requireRole(request, reply, ["ADMIN", "ANALYST"])) {
      return;
    }

    const parsed = runValuationSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        message: "Invalid valuation payload",
        issues: parsed.error.issues,
      });
    }

    const snapshot = await valuationService.runPortfolioValuation(
      parsed.data.portfolioId,
      parsed.data.asOf,
    );

    return reply.status(201).send(snapshot);
  });
}
