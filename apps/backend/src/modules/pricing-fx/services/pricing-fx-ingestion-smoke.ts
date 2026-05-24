import { postgresPool } from "../../../db/postgres-pool";
import { env } from "../../../config/env";
import type {
  FxRateIngestRecord,
  SecurityPriceIngestRecord,
} from "../domain/market-data";
import { PostgresPricingFxRepository } from "../adapters/postgres-pricing-fx-repository";
import {
  PricingFxIngestionService,
  type FxPair,
  type PricingFxProvider,
} from "./pricing-fx-ingestion-service";

class DeterministicPricingFxProvider implements PricingFxProvider {
  async fetchSecurityPrices(
    securityIds: string[],
    asOfDate: string,
  ): Promise<SecurityPriceIngestRecord[]> {
    return securityIds.map((securityId, index) => ({
      securityId,
      asOfDate,
      price: Number((100 + index * 1.25).toFixed(4)),
      currency: "USD",
    }));
  }

  async fetchFxRates(pairs: FxPair[], asOfDate: string): Promise<FxRateIngestRecord[]> {
    return pairs.map((pair, index) => ({
      fromCurrency: pair.fromCurrency,
      toCurrency: pair.toCurrency,
      asOfDate,
      rate: Number((1 + index * 0.01).toFixed(6)),
    }));
  }
}

async function run() {
  const repository = new PostgresPricingFxRepository(postgresPool);
  const provider = new DeterministicPricingFxProvider();
  const ingestionService = new PricingFxIngestionService(repository, provider);

  const maxSecurityDateResult = await postgresPool.query<{ as_of_date: string }>(
    `SELECT COALESCE(MAX(price_date)::text, CURRENT_DATE::text) AS as_of_date FROM security_prices`,
  );
  const asOfDate = maxSecurityDateResult.rows[0].as_of_date;

  const securityRows = await postgresPool.query<{ id: string }>(
    `SELECT id FROM securities ORDER BY created_at ASC LIMIT 3`,
  );
  const securityIds = securityRows.rows.map((row) => row.id);

  if (securityIds.length === 0) {
    throw new Error("No securities available for pricing ingestion smoke test");
  }

  const pairRows = await postgresPool.query<{ from_currency: string; to_currency: string }>(
    `
    SELECT DISTINCT from_currency, to_currency
    FROM fx_rates
    ORDER BY from_currency, to_currency
    LIMIT 2
    `,
  );

  const fxPairs: FxPair[] =
    pairRows.rows.length > 0
      ? pairRows.rows.map((row) => ({
          fromCurrency: row.from_currency,
          toCurrency: row.to_currency,
        }))
      : [
          { fromCurrency: "USD", toCurrency: "EUR" },
          { fromCurrency: "EUR", toCurrency: "USD" },
        ];

  const jobResult = await ingestionService.runJob({
    asOfDate,
    source: env.PRICING_FX_JOB_SOURCE,
    securityIds,
    fxPairs,
    securityPriceSlaHours: env.PRICING_PRICE_SLA_HOURS,
    fxRateSlaHours: env.PRICING_FX_SLA_HOURS,
  });

  const staleGuardResult = await repository.upsertSecurityPricesWithStaleGuard(
    env.PRICING_FX_JOB_SOURCE,
    securityIds.map((securityId, index) => ({
      securityId,
      asOfDate: "2000-01-01",
      price: Number((50 + index).toFixed(4)),
      currency: "USD",
    })),
  );

  console.log("pricing-fx-ingestion-smoke: ok");
  console.log(
    JSON.stringify(
      {
        asOfDate,
        jobResult,
        staleGuardCheck: staleGuardResult,
      },
      null,
      2,
    ),
  );
}

run()
  .catch((error) => {
    console.error("pricing-fx-ingestion-smoke: failed", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await postgresPool.end();
  });
