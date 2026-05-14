import type { PerformanceMetrics } from "../../domain/performance-metrics";
import type { ValuationSnapshot } from "../../../valuation/domain/valuation";

export interface ValuationHistoryPort {
  listSnapshots(portfolioId: string): Promise<ValuationSnapshot[]>;
}

export interface PerformanceMetricsRepositoryPort {
  save(metrics: PerformanceMetrics): Promise<void>;
}
