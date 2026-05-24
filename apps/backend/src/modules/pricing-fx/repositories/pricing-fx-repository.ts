import type {
  FreshnessStatus,
  FxRate,
  FxRateIngestRecord,
  IngestionWriteSummary,
  SecurityPrice,
  SecurityPriceIngestRecord,
} from "../domain/market-data";

export interface PricingFxRepository {
  getSecurityPrice(securityId: string, asOf: string): Promise<SecurityPrice | null>;
  getFxRate(fromCurrency: string, toCurrency: string, asOf: string): Promise<FxRate | null>;
  upsertSecurityPricesWithStaleGuard(
    source: string,
    records: SecurityPriceIngestRecord[],
  ): Promise<IngestionWriteSummary>;
  upsertFxRatesWithStaleGuard(
    source: string,
    records: FxRateIngestRecord[],
  ): Promise<IngestionWriteSummary>;
  getSecurityPriceFreshnessStatus(
    asOfDate: string,
    maxAgeHours: number,
    requiredSecurityIds: string[],
  ): Promise<FreshnessStatus>;
  getFxRateFreshnessStatus(
    asOfDate: string,
    maxAgeHours: number,
    requiredPairs: Array<{ fromCurrency: string; toCurrency: string }>,
  ): Promise<FreshnessStatus>;
}
