import Fastify from "fastify";
import cors from "@fastify/cors";
import { env } from "./config/env";
import { buildContainer } from "./bootstrap/container";
import { registerTradeRoutes } from "./modules/trade-registry/routes/trade-routes";
import { moduleDependencyRules } from "./modules/boundary-rules";

const app = Fastify({ logger: true });
const container = buildContainer();

await app.register(cors, {
  origin: true,
});

await registerTradeRoutes(app, container.tradeRegistryService);

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
