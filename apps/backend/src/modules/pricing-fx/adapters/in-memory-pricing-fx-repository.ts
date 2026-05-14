import type { FxRate, SecurityPrice } from "../domain/market-data";
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
}
