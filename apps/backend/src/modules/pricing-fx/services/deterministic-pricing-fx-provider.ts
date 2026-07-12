import type {
  FxRateIngestRecord,
  SecurityPriceIngestRecord,
} from "../domain/market-data";
import type {
  FxPair,
  PricingFxProvider,
} from "./pricing-fx-ingestion-service";

function stableHash(input: string): number {
  let hash = 0;
  for (let i = 0; i < input.length; i += 1) {
    hash = (hash * 31 + input.charCodeAt(i)) >>> 0;
  }
  return hash;
}

function fxBase(fromCurrency: string, toCurrency: string): number {
  if (fromCurrency === toCurrency) {
    return 1;
  }

  const pair = `${fromCurrency}/${toCurrency}`;
  switch (pair) {
    case "USD/EUR":
      return 0.92;
    case "EUR/USD":
      return 1.087;
    case "USD/CHF":
      return 0.89;
    case "CHF/USD":
      return 1.124;
    case "EUR/CHF":
      return 0.97;
    case "CHF/EUR":
      return 1.031;
    default:
      return 1;
  }
}

export class DeterministicPricingFxProvider implements PricingFxProvider {
  async fetchSecurityPrices(
    securityIds: string[],
    asOfDate: string,
  ): Promise<SecurityPriceIngestRecord[]> {
    return securityIds.map((securityId, index) => {
      const hash = stableHash(`${securityId}:${asOfDate}`);
      const drift = ((hash % 2001) - 1000) / 100000;
      const base = 100 + index * 3.5;
      const price = Number((base * (1 + drift)).toFixed(4));

      return {
        securityId,
        asOfDate,
        price: Math.max(1, price),
        currency: "USD",
      };
    });
  }

  async fetchFxRates(pairs: FxPair[], asOfDate: string): Promise<FxRateIngestRecord[]> {
    return pairs.map((pair) => {
      const base = fxBase(pair.fromCurrency, pair.toCurrency);
      const hash = stableHash(`${pair.fromCurrency}:${pair.toCurrency}:${asOfDate}`);
      const drift = ((hash % 1001) - 500) / 100000;

      return {
        fromCurrency: pair.fromCurrency,
        toCurrency: pair.toCurrency,
        asOfDate,
        rate: Number((base * (1 + drift)).toFixed(8)),
      };
    });
  }
}
