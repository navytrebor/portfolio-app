import assert from "node:assert/strict";
import { Pool } from "pg";
import { createAuthToken, type UserRole } from "../auth/request-auth";
import { env } from "../config/env";

type SeedContext = {
  userId: string;
  portfolioId: string;
  securityId: string;
  asOf: string;
};

const REQUEST_TIMEOUT_MS = 10_000;

function apiBaseUrl(): string {
  return process.env.API_BASE_URL ?? `http://127.0.0.1:${env.PORT}`;
}

async function getSeedContext(pool: Pool): Promise<SeedContext> {
  const userResult = await pool.query<{ id: string }>(
    `SELECT id FROM users ORDER BY created_at ASC LIMIT 1`,
  );
  assert.ok(userResult.rows[0], "No users found. Run db:seed first.");

  const userId = userResult.rows[0].id;

  const portfolioResult = await pool.query<{ id: string }>(
    `SELECT id FROM portfolios WHERE user_id = $1 ORDER BY created_at ASC LIMIT 1`,
    [userId],
  );
  assert.ok(portfolioResult.rows[0], "No portfolios found for seeded user.");

  const securityResult = await pool.query<{ id: string }>(
    `SELECT id FROM securities ORDER BY created_at ASC LIMIT 1`,
  );
  assert.ok(securityResult.rows[0], "No securities found. Run db:seed first.");

  return {
    userId,
    portfolioId: portfolioResult.rows[0].id,
    securityId: securityResult.rows[0].id,
    asOf: new Date().toISOString(),
  };
}

async function callApi(
  path: string,
  options: RequestInit,
): Promise<{ status: number; body: unknown }> {
  let response: Response;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    response = await fetch(`${apiBaseUrl()}${path}`, {
      ...options,
      signal: controller.signal,
    });
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error(
        `Request to ${apiBaseUrl()}${path} timed out after ${REQUEST_TIMEOUT_MS}ms.`,
        { cause: error },
      );
    }

    throw new Error(
      `Unable to reach backend at ${apiBaseUrl()}. Start backend with pnpm --filter @portfolio/backend dev.`,
      { cause: error },
    );
  } finally {
    clearTimeout(timeout);
  }

  const text = await response.text();
  let body: unknown = text;

  try {
    body = text.length > 0 ? JSON.parse(text) : null;
  } catch {
    body = text;
  }

  return {
    status: response.status,
    body,
  };
}

function authHeaders(userId: string, role: UserRole): Record<string, string> {
  return {
    authorization: `Bearer ${createAuthToken({ userId, role })}`,
    "content-type": "application/json",
  };
}

async function run() {
  const pool = new Pool({
    host: env.POSTGRES_HOST,
    port: env.POSTGRES_PORT,
    database: env.POSTGRES_DB,
    user: env.POSTGRES_USER,
    password: env.POSTGRES_PASSWORD,
    ssl: env.POSTGRES_SSL ? { rejectUnauthorized: false } : false,
  });

  try {
    const context = await getSeedContext(pool);

    const portfolios = await callApi("/api/portfolios", {
      method: "GET",
      headers: authHeaders(context.userId, "VIEWER"),
    });
    assert.equal(portfolios.status, 200, "Expected portfolios endpoint to return 200");

    const security = await callApi(`/api/securities/${context.securityId}`, {
      method: "GET",
      headers: authHeaders(context.userId, "VIEWER"),
    });
    assert.equal(security.status, 200, "Expected securities endpoint to return 200");

    const trades = await callApi("/api/trades", {
      method: "GET",
      headers: authHeaders(context.userId, "ANALYST"),
    });
    assert.equal(trades.status, 200, "Expected trades endpoint to return 200");

    const valuationRun = await callApi("/api/valuations/run", {
      method: "POST",
      headers: authHeaders(context.userId, "ANALYST"),
      body: JSON.stringify({
        portfolioId: context.portfolioId,
        asOf: context.asOf,
      }),
    });
    assert.equal(valuationRun.status, 201, "Expected valuation run to return 201");

    const performanceRun = await callApi("/api/analytics/performance/run", {
      method: "POST",
      headers: authHeaders(context.userId, "ANALYST"),
      body: JSON.stringify({
        portfolioId: context.portfolioId,
        asOf: context.asOf,
      }),
    });
    assert.equal(performanceRun.status, 201, "Expected analytics run to return 201");

    const forbiddenTradeWrite = await callApi("/api/trades", {
      method: "POST",
      headers: authHeaders(context.userId, "VIEWER"),
      body: JSON.stringify({
        portfolioId: context.portfolioId,
        securityId: context.securityId,
        side: "BUY",
        quantity: 1,
        price: 100,
        tradeDate: context.asOf,
        currency: "USD",
      }),
    });
    assert.equal(forbiddenTradeWrite.status, 403, "Expected viewer trade write to be denied");

    console.log("authenticated-api-smoke: ok");
    console.log(
      JSON.stringify(
        {
          baseUrl: apiBaseUrl(),
          portfolioStatus: portfolios.status,
          securityStatus: security.status,
          tradesStatus: trades.status,
          valuationStatus: valuationRun.status,
          analyticsStatus: performanceRun.status,
          forbiddenTradeWriteStatus: forbiddenTradeWrite.status,
        },
        null,
        2,
      ),
    );
  } finally {
    await pool.end();
  }
}

run().catch((error) => {
  console.error("authenticated-api-smoke: failed", error);
  process.exitCode = 1;
});
