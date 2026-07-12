import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import { z } from "zod";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, "../../.env") });
dotenv.config({ path: path.resolve(__dirname, "../../../../.env") });

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(4000),
  AUTH_TOKEN_SECRET: z.string().min(1),
  POSTGRES_HOST: z.string().min(1),
  POSTGRES_PORT: z.coerce.number().int().positive().default(5432),
  POSTGRES_DB: z.string().min(1),
  POSTGRES_USER: z.string().min(1),
  POSTGRES_PASSWORD: z.string().min(1),
  POSTGRES_SSL: z
    .string()
    .transform((v) => v === "true" || v === "1")
    .default("false"),
  IDEMPOTENCY_TTL_HOURS: z.coerce.number().int().positive().default(24),
  REDIS_HOST: z.string().min(1),
  REDIS_PORT: z.coerce.number().int().positive().default(6379),
  PRICING_FX_JOB_SOURCE: z.string().min(1).default("ingestion-job"),
  PRICING_PRICE_SLA_HOURS: z.coerce.number().int().positive().default(36),
  PRICING_FX_SLA_HOURS: z.coerce.number().int().positive().default(36),
  PERFORMANCE_BENCHMARK_TICKER: z.string().min(1).default("SPY"),
});

export const env = envSchema.parse(process.env);
