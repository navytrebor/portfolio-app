import type { PerformanceMetrics } from "../../domain/performance-metrics";
import type { ValuationSnapshot } from "../../../valuation/domain/valuation";

export type ConcentrationRiskIndicators = {
  concentrationHhi: number;
  topPositionWeight: number;
};

export interface ValuationHistoryPort {
  listSnapshots(portfolioId: string, asOf: string): Promise<ValuationSnapshot[]>;
}

export interface BenchmarkComparisonPort {
  computeBenchmarkReturn(
    baseCurrency: string,
    fromAsOf: string,
    toAsOf: string,
  ): Promise<number | null>;
}

export interface ConcentrationRiskPort {
  computeConcentrationRisk(
    portfolioId: string,
    asOf: string,
    baseCurrency: string,
    portfolioValue: number,
  ): Promise<ConcentrationRiskIndicators | null>;
}

export interface PerformanceMetricsRepositoryPort {
  save(metrics: PerformanceMetrics): Promise<void>;
}
