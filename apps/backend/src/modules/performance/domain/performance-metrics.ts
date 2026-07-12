export type PerformanceMetrics = {
  portfolioId: string;
  asOf: string;
  twr: number;
  mwr: number;
  drawdown: number;
  rollingVolatility: number | null;
  benchmarkReturn: number | null;
  benchmarkSpread: number | null;
  concentrationHhi: number | null;
  topPositionWeight: number | null;
};
