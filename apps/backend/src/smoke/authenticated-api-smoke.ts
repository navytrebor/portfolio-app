import assert from "node:assert/strict";
import { Pool } from "pg";
import { createAuthToken, type UserRole } from "../auth/request-auth";
import { env } from "../config/env";
import { API_V1_PREFIX } from "../http/api-versioning";

type SeedContext = {
  adminUserId: string;
  analystUserId: string;
  traderUserId: string;
  adminPortfolioId: string;
  analystPortfolioId: string;
  portfolioBaseCurrency: string;
  securityId: string;
  asOf: string;
};

const REQUEST_TIMEOUT_MS = 10_000;

function apiBaseUrl(): string {
  return process.env.API_BASE_URL ?? `http://127.0.0.1:${env.PORT}`;
}

async function getSeedContext(pool: Pool): Promise<SeedContext> {
  const userResult = await pool.query<{ id: string; email: string; role: UserRole }>(
    `SELECT id, email, role FROM users WHERE email = ANY($1::text[]) ORDER BY created_at ASC`,
    [["alice@example.com", "bob@example.com", "carol@example.com"]],
  );
  assert.equal(userResult.rows.length >= 3, true, "Expected seeded users for alice, bob, and carol.");

  const byEmail = new Map(userResult.rows.map((row) => [row.email, row]));
  const adminUser = byEmail.get("alice@example.com");
  const analystUser = byEmail.get("bob@example.com");
  const traderUser = byEmail.get("carol@example.com");

  assert.ok(adminUser, "Expected seeded admin user.");
  assert.ok(analystUser, "Expected seeded analyst user.");
  assert.ok(traderUser, "Expected seeded trader user.");

  const adminPortfolioResult = await pool.query<{ id: string; base_currency: string }>(
    `SELECT id, base_currency FROM portfolios WHERE user_id = $1 ORDER BY created_at ASC LIMIT 1`,
    [adminUser.id],
  );
  assert.ok(adminPortfolioResult.rows[0], "No portfolio found for seeded admin user.");

  const analystPortfolioResult = await pool.query<{ id: string; base_currency: string }>(
    `SELECT id, base_currency FROM portfolios WHERE user_id = $1 ORDER BY created_at ASC LIMIT 1`,
    [analystUser.id],
  );
  assert.ok(analystPortfolioResult.rows[0], "No portfolio found for seeded analyst user.");

  const securityResult = await pool.query<{ id: string }>(
    `SELECT id FROM securities ORDER BY created_at ASC LIMIT 1`,
  );
  assert.ok(securityResult.rows[0], "No securities found. Run db:seed first.");

  const latestPriceDateResult = await pool.query<{ latest_price_date: string | null }>(
    `SELECT MAX(price_date)::text AS latest_price_date FROM security_prices`,
  );
  const latestPriceDate = latestPriceDateResult.rows[0]?.latest_price_date;
  assert.ok(latestPriceDate, "No security prices found. Run db:seed first.");

  const asOfDate = latestPriceDate;
  return {
    adminUserId: adminUser.id,
    analystUserId: analystUser.id,
    traderUserId: traderUser.id,
    adminPortfolioId: adminPortfolioResult.rows[0].id,
    analystPortfolioId: analystPortfolioResult.rows[0].id,
    portfolioBaseCurrency: adminPortfolioResult.rows[0].base_currency,
    securityId: securityResult.rows[0].id,
    asOf: `${asOfDate}T17:00:00.000Z`,
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

    const portfolios = await callApi(`${API_V1_PREFIX}/portfolios`, {
      method: "GET",
      headers: authHeaders(context.traderUserId, "TRADER"),
    });
    assert.equal(portfolios.status, 200, "Expected portfolios endpoint to return 200");

    const portfoliosBody = portfolios.body as {
      items?: unknown;
      page?: { limit?: unknown; offset?: unknown; total?: unknown; returned?: unknown; hasMore?: unknown };
    };
    assert.equal(Array.isArray(portfoliosBody.items), true, "Expected paginated portfolio items");
    assert.equal(typeof portfoliosBody.page?.total === "number", true, "Expected portfolio page metadata");

    const securities = await callApi(`${API_V1_PREFIX}/securities?limit=2&offset=0&ticker=AAPL`, {
      method: "GET",
      headers: authHeaders(context.traderUserId, "TRADER"),
    });
    assert.equal(securities.status, 200, "Expected securities collection endpoint to return 200");

    const securitiesBody = securities.body as {
      items?: Array<{ ticker?: unknown }>;
      page?: { returned?: unknown };
    };
    assert.equal(Array.isArray(securitiesBody.items), true, "Expected paginated securities items");
    assert.equal(
      securitiesBody.items?.every((item) => item.ticker === "AAPL") ?? false,
      true,
      "Expected securities filter to restrict by ticker",
    );

    const security = await callApi(`${API_V1_PREFIX}/securities/${context.securityId}`, {
      method: "GET",
      headers: authHeaders(context.traderUserId, "TRADER"),
    });
    assert.equal(security.status, 200, "Expected securities endpoint to return 200");

    const trades = await callApi(
      `${API_V1_PREFIX}/trades?limit=10&offset=0&portfolioId=${context.adminPortfolioId}`,
      {
      method: "GET",
      headers: authHeaders(context.adminUserId, "ADMIN"),
      },
    );
    assert.equal(trades.status, 200, "Expected trades endpoint to return 200");

    const tradesBody = trades.body as {
      items?: Array<{ portfolioId?: unknown }>;
      page?: { total?: unknown };
    };
    assert.equal(Array.isArray(tradesBody.items), true, "Expected paginated trade items");
    assert.equal(
      tradesBody.items?.every((item) => item.portfolioId === context.adminPortfolioId) ?? false,
      true,
      "Expected trades filter to restrict by portfolioId",
    );

    const valuationRun = await callApi(`${API_V1_PREFIX}/valuations/run`, {
      method: "POST",
      headers: authHeaders(context.adminUserId, "ADMIN"),
      body: JSON.stringify({
        portfolioId: context.adminPortfolioId,
        asOf: context.asOf,
      }),
    });
    assert.equal(valuationRun.status, 201, "Expected valuation run to return 201");
    assert.equal(
      typeof valuationRun.body === "object" && valuationRun.body !== null,
      true,
      "Expected valuation response body",
    );

    const valuationBody = valuationRun.body as {
      totalValue?: unknown;
      currency?: unknown;
      securitiesValue?: unknown;
    };

    assert.equal(
      typeof valuationBody.totalValue === "number" && valuationBody.totalValue > 0,
      true,
      "Expected valuation totalValue > 0",
    );
    assert.equal(
      typeof valuationBody.securitiesValue === "number" && valuationBody.securitiesValue > 0,
      true,
      "Expected valuation securitiesValue > 0",
    );
    assert.equal(
      valuationBody.currency,
      context.portfolioBaseCurrency,
      "Expected valuation currency to match portfolio base currency",
    );

    const performanceRun = await callApi(`${API_V1_PREFIX}/analytics/performance/run`, {
      method: "POST",
      headers: authHeaders(context.adminUserId, "ADMIN"),
      body: JSON.stringify({
        portfolioId: context.adminPortfolioId,
        asOf: context.asOf,
      }),
    });
    assert.equal(performanceRun.status, 201, "Expected analytics run to return 201");
    assert.equal(
      typeof performanceRun.body === "object" && performanceRun.body !== null,
      true,
      "Expected analytics response body",
    );

    const analyticsBody = performanceRun.body as {
      twr?: unknown;
      mwr?: unknown;
      drawdown?: unknown;
      rollingVolatility?: unknown;
      benchmarkSpread?: unknown;
      concentrationHhi?: unknown;
      topPositionWeight?: unknown;
    };

    assert.equal(typeof analyticsBody.twr === "number", true, "Expected twr metric");
    assert.equal(typeof analyticsBody.mwr === "number", true, "Expected mwr metric");
    assert.equal(typeof analyticsBody.drawdown === "number", true, "Expected drawdown metric");
    assert.equal(
      analyticsBody.rollingVolatility === null ||
        typeof analyticsBody.rollingVolatility === "number",
      true,
      "Expected rolling volatility metric",
    );
    assert.equal(
      analyticsBody.benchmarkSpread === null || typeof analyticsBody.benchmarkSpread === "number",
      true,
      "Expected benchmark spread metric",
    );
    assert.equal(
      analyticsBody.concentrationHhi === null || typeof analyticsBody.concentrationHhi === "number",
      true,
      "Expected concentration HHI metric",
    );
    assert.equal(
      analyticsBody.topPositionWeight === null ||
        typeof analyticsBody.topPositionWeight === "number",
      true,
      "Expected top position weight metric",
    );

    const forbiddenTradeWrite = await callApi(`${API_V1_PREFIX}/trades`, {
      method: "POST",
      headers: authHeaders(context.analystUserId, "ANALYST"),
      body: JSON.stringify({
        portfolioId: context.analystPortfolioId,
        securityId: context.securityId,
        side: "BUY",
        quantity: 1,
        price: 100,
        tradeDate: context.asOf,
        currency: "USD",
      }),
    });
    assert.equal(forbiddenTradeWrite.status, 403, "Expected viewer trade write to be denied");
    const forbiddenBody = forbiddenTradeWrite.body as {
      error?: { code?: unknown; requestId?: unknown };
    };
    assert.equal(forbiddenBody.error?.code, "FORBIDDEN", "Expected consistent error code");
    assert.equal(typeof forbiddenBody.error?.requestId === "string", true, "Expected requestId in error envelope");

    console.log("authenticated-api-smoke: ok");
    console.log(
      JSON.stringify(
        {
          baseUrl: apiBaseUrl(),
          portfolioStatus: portfolios.status,
          securitiesStatus: securities.status,
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
