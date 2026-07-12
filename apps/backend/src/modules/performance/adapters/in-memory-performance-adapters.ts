import type { PerformanceMetrics } from "../domain/performance-metrics";
import type {
  BenchmarkComparisonPort,
  ConcentrationRiskIndicators,
  ConcentrationRiskPort,
  PerformanceMetricsRepositoryPort,
  ValuationHistoryPort,
} from "../application/ports/performance-ports";
import type { ValuationSnapshot } from "../../valuation/domain/valuation";

export class InMemoryValuationHistory implements ValuationHistoryPort {
  async listSnapshots(_portfolioId: string, _asOf: string): Promise<ValuationSnapshot[]> {
    return [];
  }
}

export class InMemoryBenchmarkComparison implements BenchmarkComparisonPort {
  async computeBenchmarkReturn(
    _baseCurrency: string,
    _fromAsOf: string,
    _toAsOf: string,
  ): Promise<number | null> {
    return null;
  }
}

export class InMemoryConcentrationRisk implements ConcentrationRiskPort {
  async computeConcentrationRisk(
    _portfolioId: string,
    _asOf: string,
    _baseCurrency: string,
    _portfolioValue: number,
  ): Promise<ConcentrationRiskIndicators | null> {
    return null;
  }
}

export class InMemoryPerformanceMetricsRepository
  implements PerformanceMetricsRepositoryPort
{
  private readonly metrics: PerformanceMetrics[] = [];

  async save(entry: PerformanceMetrics): Promise<void> {
    this.metrics.push(entry);
  }
}
