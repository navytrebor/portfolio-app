import { Pool } from "pg";
import { env } from "../config/env";

export const postgresPool = new Pool({
  host: env.POSTGRES_HOST,
  port: env.POSTGRES_PORT,
  database: env.POSTGRES_DB,
  user: env.POSTGRES_USER,
  password: env.POSTGRES_PASSWORD,
  ssl: env.POSTGRES_SSL ? { rejectUnauthorized: false } : false,
});
