import assert from "node:assert/strict";
import { buildContainer } from "../bootstrap/container";
import { env } from "../config/env";
import { postgresPool } from "../db/postgres-pool";

function currentUtcDateString(): string {
  return new Date().toISOString().slice(0, 10);
}

function buildAsOfTimestamp(date: string, utcHour: number): string {
  const hour = String(Math.max(0, Math.min(23, utcHour))).padStart(2, "0");
  return `${date}T${hour}:00:00.000Z`;
}

function pickWorkflowAsOfDate(currentDate: string, latestMarketDate: string | null): string {
  if (!latestMarketDate) {
    return currentDate;
  }

  return latestMarketDate > currentDate ? latestMarketDate : currentDate;
}

async function run() {
  const container = buildContainer();
  const asOfDate = pickWorkflowAsOfDate(
    currentUtcDateString(),
    await container.pricingFxService.getLatestMarketDataAsOfDate(),
  );
  const asOf = buildAsOfTimestamp(asOfDate, env.VALUATION_EOD_UTC_HOUR);

  await container.backgroundWorkflowOrchestrator.runAllOnce();

  const valuationCountResult = await postgresPool.query<{ count: string }>(
    `
    SELECT COUNT(*)::text AS count
    FROM valuation_snapshots
    WHERE as_of = $1::timestamptz
    `,
    [asOf],
  );

  const performanceCountResult = await postgresPool.query<{ count: string }>(
    `
    SELECT COUNT(*)::text AS count
    FROM performance_snapshots
    WHERE as_of = $1::timestamptz
    `,
    [asOf],
  );

  const valuationCount = Number(valuationCountResult.rows[0]?.count ?? 0);
  const performanceCount = Number(performanceCountResult.rows[0]?.count ?? 0);

  assert.ok(valuationCount > 0, "Expected EOD valuation snapshots to be persisted");
  assert.ok(
    performanceCount > 0,
    "Expected analytics cache refresh snapshots to be persisted",
  );

  console.log("background-workflow-smoke: ok");
  console.log(
    JSON.stringify(
      {
        asOf,
        valuationCount,
        performanceCount,
      },
      null,
      2,
    ),
  );
}

run()
  .catch((error) => {
    console.error("background-workflow-smoke: failed", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await postgresPool.end();
  });
