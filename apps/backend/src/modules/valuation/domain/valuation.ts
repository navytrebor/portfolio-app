export type ReconstructedPosition = {
  portfolioId: string;
  securityId: string;
  quantity: number;
  averageCost: number;
  currency: string;
};

export type PositionSnapshot = ReconstructedPosition & {
  asOf: string;
  marketValue: number;
};

export type ValuationSnapshot = {
  portfolioId: string;
  asOf: string;
  securitiesValue: number;
  cashValue: number;
  totalValue: number;
  currency: string;
};
