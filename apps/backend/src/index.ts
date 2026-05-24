import Fastify from "fastify";
import cors from "@fastify/cors";
import { env } from "./config/env";
import { buildContainer } from "./bootstrap/container";
import { registerPortfolioRoutes } from "./modules/portfolio/routes/portfolio-routes";
import { registerSecurityRoutes } from "./modules/security-master/routes/security-routes";
import { registerTradeRoutes } from "./modules/trade-registry/routes/trade-routes";
import { registerValuationRoutes } from "./modules/valuation/routes/valuation-routes";
import { registerPerformanceRoutes } from "./modules/performance/routes/performance-routes";
import { moduleDependencyRules } from "./modules/boundary-rules";

const app = Fastify({ logger: true });
const container = buildContainer();

await app.register(cors, {
  origin: true,
});

await registerPortfolioRoutes(app, container.portfolioService);
await registerSecurityRoutes(app, container.securityMasterService);
await registerTradeRoutes(app, container.tradeRegistryService);
await registerValuationRoutes(app, container.valuationService);
await registerPerformanceRoutes(app, container.performanceService);

app.get("/health", async () => {
  return {
    status: "ok",
    environment: env.NODE_ENV,
    service: "backend",
    modules: Object.keys(moduleDependencyRules),
  };
});

const port = env.PORT;

try {
  await app.listen({ host: "0.0.0.0", port });
} catch (err) {
  app.log.error(err);
  process.exit(1);
}
