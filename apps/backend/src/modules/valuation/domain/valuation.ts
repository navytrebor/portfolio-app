export type PositionSnapshot = {
  portfolioId: string;
  securityId: string;
  quantity: number;
};

export type ValuationSnapshot = {
  portfolioId: string;
  asOf: string;
  totalValue: number;
  currency: string;
};
