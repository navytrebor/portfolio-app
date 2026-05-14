import Fastify from "fastify";
import cors from "@fastify/cors";
import {
  createTradeRequestSchema,
  tradeSchema,
  type CreateTradeRequest,
  type Trade,
} from "@portfolio/contracts";
import { env } from "./config/env";

const app = Fastify({ logger: true });

await app.register(cors, {
  origin: true,
});

const trades: Trade[] = [];

app.get("/health", async () => {
  return {
    status: "ok",
    environment: env.NODE_ENV,
    service: "backend",
  };
});

app.get("/api/trades", async () => {
  return { items: trades };
});

app.post("/api/trades", async (request, reply) => {
  const parsed = createTradeRequestSchema.safeParse(request.body);

  if (!parsed.success) {
    return reply.status(400).send({
      message: "Invalid trade payload",
      issues: parsed.error.issues,
    });
  }

  const payload: CreateTradeRequest = parsed.data;

  const trade: Trade = tradeSchema.parse({
    id: crypto.randomUUID(),
    ...payload,
  });

  trades.push(trade);

  return reply.status(201).send(trade);
});

const port = env.PORT;

try {
  await app.listen({ host: "0.0.0.0", port });
} catch (err) {
  app.log.error(err);
  process.exit(1);
}
