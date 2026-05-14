import type { FxRate, SecurityPrice } from "../domain/market-data";

export interface PricingFxRepository {
  getSecurityPrice(securityId: string, asOf: string): Promise<SecurityPrice | null>;
  getFxRate(fromCurrency: string, toCurrency: string, asOf: string): Promise<FxRate | null>;
}
