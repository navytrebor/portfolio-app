export type SecurityPrice = {
  securityId: string;
  asOf: string;
  price: number;
  currency: string;
};

export type SecurityPriceIngestRecord = {
  securityId: string;
  asOfDate: string;
  price: number;
  currency: string;
};

export type FxRate = {
  fromCurrency: string;
  toCurrency: string;
  asOf: string;
  rate: number;
};

export type FxRateIngestRecord = {
  fromCurrency: string;
  toCurrency: string;
  asOfDate: string;
  rate: number;
};

export type IngestionWriteSummary = {
  processed: number;
  ingested: number;
  skippedStale: number;
};

export type FreshnessStatus = {
  staleCount: number;
  thresholdDate: string;
};

export type PricingFxIngestionJobResult = {
  securityPrices: IngestionWriteSummary;
  fxRates: IngestionWriteSummary;
  freshness: {
    securityPrices: FreshnessStatus;
    fxRates: FreshnessStatus;
  };
};
