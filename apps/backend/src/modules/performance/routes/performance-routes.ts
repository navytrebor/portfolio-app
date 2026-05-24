import type { FastifyInstance } from "fastify";
import { z } from "zod";
import type { PerformanceService } from "../application/services/performance-service";
import { requireRole } from "../../../auth/request-auth";

const runPerformanceSchema = z.object({
  portfolioId: z.string().uuid(),
  asOf: z.string().datetime(),
});

export async function registerPerformanceRoutes(
  app: FastifyInstance,
  performanceService: PerformanceService,
) {
  app.post("/api/analytics/performance/run", async (request, reply) => {
    if (!requireRole(request, reply, ["ADMIN", "ANALYST"])) {
      return;
    }

    const parsed = runPerformanceSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        message: "Invalid performance payload",
        issues: parsed.error.issues,
      });
    }

    const metrics = await performanceService.computeAndStore(
      parsed.data.portfolioId,
      parsed.data.asOf,
    );

    return reply.status(201).send(metrics);
  });
}
