export type SecurityPrice = {
  securityId: string;
  asOf: string;
  price: number;
  currency: string;
};

export type FxRate = {
  fromCurrency: string;
  toCurrency: string;
  asOf: string;
  rate: number;
};
