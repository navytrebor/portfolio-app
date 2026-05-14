import type { PerformanceMetrics } from "../../domain/performance-metrics";
import type {
  PerformanceMetricsRepositoryPort,
  ValuationHistoryPort,
} from "../ports/performance-ports";

export class PerformanceService {
  constructor(
    private readonly valuationHistory: ValuationHistoryPort,
    private readonly metricsRepository: PerformanceMetricsRepositoryPort,
  ) {}

  async computeAndStore(portfolioId: string, asOf: string): Promise<PerformanceMetrics> {
    const snapshots = await this.valuationHistory.listSnapshots(portfolioId);

    const metrics: PerformanceMetrics = {
      portfolioId,
      asOf,
      twr: snapshots.length > 1 ? 0 : 0,
      mwr: snapshots.length > 1 ? 0 : 0,
      drawdown: 0,
    };

    await this.metricsRepository.save(metrics);
    return metrics;
  }
}
