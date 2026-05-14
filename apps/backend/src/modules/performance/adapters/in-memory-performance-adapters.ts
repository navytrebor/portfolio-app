import type { PerformanceMetrics } from "../domain/performance-metrics";
import type {
  PerformanceMetricsRepositoryPort,
  ValuationHistoryPort,
} from "../application/ports/performance-ports";
import type { ValuationSnapshot } from "../../valuation/domain/valuation";

export class InMemoryValuationHistory implements ValuationHistoryPort {
  async listSnapshots(_portfolioId: string): Promise<ValuationSnapshot[]> {
    return [];
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
