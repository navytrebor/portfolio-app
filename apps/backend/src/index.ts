import Fastify from "fastify";
import cors from "@fastify/cors";
import { env } from "./config/env";
import { buildContainer } from "./bootstrap/container";
import { registerApiErrorHandler } from "./http/api-errors";
import { registerPortfolioRoutes } from "./modules/portfolio/routes/portfolio-routes";
import { registerSecurityRoutes } from "./modules/security-master/routes/security-routes";
import { registerTradeRoutes } from "./modules/trade-registry/routes/trade-routes";
import { registerValuationRoutes } from "./modules/valuation/routes/valuation-routes";
import { registerPerformanceRoutes } from "./modules/performance/routes/performance-routes";
import { moduleDependencyRules } from "./modules/boundary-rules";

const app = Fastify({ logger: true });
const container = buildContainer();

registerApiErrorHandler(app);

container.backgroundWorkflowOrchestrator.setLogger({
  info: (payload, message) => {
    if (message) {
      app.log.info(payload, message);
      return;
    }
    app.log.info(payload);
  },
  warn: (payload, message) => {
    if (message) {
      app.log.warn(payload, message);
      return;
    }
    app.log.warn(payload);
  },
  error: (payload, message) => {
    if (message) {
      app.log.error(payload, message);
      return;
    }
    app.log.error(payload);
  },
});

await app.register(cors, {
  origin: true,
});

await registerPortfolioRoutes(app, container.portfolioService, container.identityService);
await registerSecurityRoutes(app, container.securityMasterService, container.identityService);
await registerTradeRoutes(
  app,
  container.tradeRegistryService,
  container.portfolioService,
  container.identityService,
);
await registerValuationRoutes(
  app,
  container.valuationService,
  container.portfolioService,
  container.identityService,
);
await registerPerformanceRoutes(
  app,
  container.performanceService,
  container.portfolioService,
  container.identityService,
);

app.get("/health", async () => {
  return {
    status: "ok",
    environment: env.NODE_ENV,
    service: "backend",
    modules: Object.keys(moduleDependencyRules),
  };
});

const port = env.PORT;

let shuttingDown = false;

async function shutdown(signal: string) {
  if (shuttingDown) {
    return;
  }

  shuttingDown = true;
  app.log.info({ signal }, "shutdown initiated");

  try {
    await container.backgroundWorkflowOrchestrator.stop();
    await app.close();
    process.exit(0);
  } catch (error) {
    app.log.error({ error }, "shutdown failed");
    process.exit(1);
  }
}

try {
  await app.listen({ host: "0.0.0.0", port });

  if (env.BACKGROUND_WORKFLOWS_ENABLED) {
    await container.backgroundWorkflowOrchestrator.start();
  }

  process.on("SIGINT", () => {
    void shutdown("SIGINT");
  });

  process.on("SIGTERM", () => {
    void shutdown("SIGTERM");
  });
} catch (err) {
  app.log.error(err);
  process.exit(1);
}
