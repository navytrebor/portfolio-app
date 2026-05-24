import type {
  FreshnessStatus,
  FxRate,
  FxRateIngestRecord,
  IngestionWriteSummary,
  SecurityPrice,
  SecurityPriceIngestRecord,
} from "../domain/market-data";
import type { PricingFxRepository } from "../repositories/pricing-fx-repository";

export class InMemoryPricingFxRepository implements PricingFxRepository {
  private readonly prices = new Map<string, SecurityPrice>();
  private readonly fxRates = new Map<string, FxRate>();

  async getSecurityPrice(securityId: string, asOf: string): Promise<SecurityPrice | null> {
    return this.prices.get(`${securityId}:${asOf}`) ?? null;
  }

  async getFxRate(fromCurrency: string, toCurrency: string, asOf: string): Promise<FxRate | null> {
    return this.fxRates.get(`${fromCurrency}:${toCurrency}:${asOf}`) ?? null;
  }

  async upsertSecurityPricesWithStaleGuard(
    _source: string,
    records: SecurityPriceIngestRecord[],
  ): Promise<IngestionWriteSummary> {
    let ingested = 0;
    let skippedStale = 0;

    for (const record of records) {
      const sameSecurity = Array.from(this.prices.values())
        .filter((price) => price.securityId === record.securityId)
        .sort((a, b) => b.asOf.localeCompare(a.asOf));

      const latestAsOf = sameSecurity[0]?.asOf;
      if (latestAsOf && latestAsOf > record.asOfDate) {
        skippedStale += 1;
        continue;
      }

      this.prices.set(`${record.securityId}:${record.asOfDate}`, {
        securityId: record.securityId,
        asOf: record.asOfDate,
        price: record.price,
        currency: record.currency,
      });
      ingested += 1;
    }

    return {
      processed: records.length,
      ingested,
      skippedStale,
    };
  }

  async upsertFxRatesWithStaleGuard(
    _source: string,
    records: FxRateIngestRecord[],
  ): Promise<IngestionWriteSummary> {
    let ingested = 0;
    let skippedStale = 0;

    for (const record of records) {
      const samePair = Array.from(this.fxRates.values())
        .filter(
          (rate) =>
            rate.fromCurrency === record.fromCurrency &&
            rate.toCurrency === record.toCurrency,
        )
        .sort((a, b) => b.asOf.localeCompare(a.asOf));

      const latestAsOf = samePair[0]?.asOf;
      if (latestAsOf && latestAsOf > record.asOfDate) {
        skippedStale += 1;
        continue;
      }

      this.fxRates.set(
        `${record.fromCurrency}:${record.toCurrency}:${record.asOfDate}`,
        {
          fromCurrency: record.fromCurrency,
          toCurrency: record.toCurrency,
          asOf: record.asOfDate,
          rate: record.rate,
        },
      );
      ingested += 1;
    }

    return {
      processed: records.length,
      ingested,
      skippedStale,
    };
  }

  async getSecurityPriceFreshnessStatus(
    asOfDate: string,
    maxAgeHours: number,
  ): Promise<FreshnessStatus> {
    const thresholdDate = this.computeThresholdDate(asOfDate, maxAgeHours);
    const latestBySecurity = new Map<string, string>();

    for (const price of this.prices.values()) {
      const latest = latestBySecurity.get(price.securityId);
      if (!latest || latest < price.asOf) {
        latestBySecurity.set(price.securityId, price.asOf);
      }
    }

    const staleCount = Array.from(latestBySecurity.values()).filter(
      (date) => date < thresholdDate,
    ).length;

    return { staleCount, thresholdDate };
  }

  async getFxRateFreshnessStatus(
    asOfDate: string,
    maxAgeHours: number,
    requiredPairs: Array<{ fromCurrency: string; toCurrency: string }>,
  ): Promise<FreshnessStatus> {
    const thresholdDate = this.computeThresholdDate(asOfDate, maxAgeHours);
    let staleCount = 0;

    for (const pair of requiredPairs) {
      const latest = Array.from(this.fxRates.values())
        .filter(
          (rate) =>
            rate.fromCurrency === pair.fromCurrency &&
            rate.toCurrency === pair.toCurrency,
        )
        .sort((a, b) => b.asOf.localeCompare(a.asOf))[0]?.asOf;

      if (!latest || latest < thresholdDate) {
        staleCount += 1;
      }
    }

    return { staleCount, thresholdDate };
  }

  private computeThresholdDate(asOfDate: string, maxAgeHours: number): string {
    const asOf = new Date(`${asOfDate}T00:00:00.000Z`);
    const threshold = new Date(asOf.getTime() - maxAgeHours * 60 * 60 * 1000);
    return threshold.toISOString().slice(0, 10);
  }
}
