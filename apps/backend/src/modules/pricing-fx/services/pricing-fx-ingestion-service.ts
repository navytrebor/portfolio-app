import type {
  FxRateIngestRecord,
  PricingFxIngestionJobResult,
  SecurityPriceIngestRecord,
} from "../domain/market-data";
import type { PricingFxRepository } from "../repositories/pricing-fx-repository";

export type FxPair = {
  fromCurrency: string;
  toCurrency: string;
};

export interface PricingFxProvider {
  fetchSecurityPrices(
    securityIds: string[],
    asOfDate: string,
  ): Promise<SecurityPriceIngestRecord[]>;
  fetchFxRates(pairs: FxPair[], asOfDate: string): Promise<FxRateIngestRecord[]>;
}

export type RunPricingFxIngestionJobInput = {
  asOfDate: string;
  source: string;
  securityIds: string[];
  fxPairs: FxPair[];
  securityPriceSlaHours: number;
  fxRateSlaHours: number;
};

export class PricingFxFreshnessSlaError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PricingFxFreshnessSlaError";
  }
}

export class PricingFxIngestionService {
  constructor(
    private readonly repository: PricingFxRepository,
    private readonly provider: PricingFxProvider,
  ) {}

  async runJob(input: RunPricingFxIngestionJobInput): Promise<PricingFxIngestionJobResult> {
    const securityPrices = await this.provider.fetchSecurityPrices(
      input.securityIds,
      input.asOfDate,
    );
    const fxRates = await this.provider.fetchFxRates(input.fxPairs, input.asOfDate);

    const securitySummary = await this.repository.upsertSecurityPricesWithStaleGuard(
      input.source,
      securityPrices,
    );
    const fxSummary = await this.repository.upsertFxRatesWithStaleGuard(
      input.source,
      fxRates,
    );

    const securityFreshness = await this.repository.getSecurityPriceFreshnessStatus(
      input.asOfDate,
      input.securityPriceSlaHours,
    );
    const fxFreshness = await this.repository.getFxRateFreshnessStatus(
      input.asOfDate,
      input.fxRateSlaHours,
      input.fxPairs,
    );

    if (securityFreshness.staleCount > 0 || fxFreshness.staleCount > 0) {
      throw new PricingFxFreshnessSlaError(
        `Freshness SLA breached (securityStale=${securityFreshness.staleCount}, fxStale=${fxFreshness.staleCount})`,
      );
    }

    return {
      securityPrices: securitySummary,
      fxRates: fxSummary,
      freshness: {
        securityPrices: securityFreshness,
        fxRates: fxFreshness,
      },
    };
  }
}
