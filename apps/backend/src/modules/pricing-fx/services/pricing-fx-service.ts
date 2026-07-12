import type { FxRate, SecurityPrice } from "../domain/market-data";
import type { PricingFxRepository } from "../repositories/pricing-fx-repository";

export class PricingFxService {
  constructor(private readonly repository: PricingFxRepository) {}

  async getLatestMarketDataAsOfDate(): Promise<string | null> {
    return this.repository.getLatestMarketDataAsOfDate();
  }

  async getSecurityPrice(securityId: string, asOf: string): Promise<SecurityPrice | null> {
    return this.repository.getSecurityPrice(securityId, asOf);
  }

  async getFxRate(fromCurrency: string, toCurrency: string, asOf: string): Promise<FxRate | null> {
    return this.repository.getFxRate(fromCurrency, toCurrency, asOf);
  }
}
