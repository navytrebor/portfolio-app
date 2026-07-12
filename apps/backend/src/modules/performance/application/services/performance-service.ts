import type { PerformanceMetrics } from "../../domain/performance-metrics";
import type {
  BenchmarkComparisonPort,
  ConcentrationRiskPort,
  PerformanceMetricsRepositoryPort,
  ValuationHistoryPort,
} from "../ports/performance-ports";
import type { ValuationSnapshot } from "../../../valuation/domain/valuation";

const ROLLING_VOLATILITY_WINDOW = 21;

function toTimestamp(value: string): number {
  return new Date(value).getTime();
}

function sortSnapshots(snapshots: ValuationSnapshot[]): ValuationSnapshot[] {
  return [...snapshots].sort((left, right) => toTimestamp(left.asOf) - toTimestamp(right.asOf));
}

function periodReturns(snapshots: ValuationSnapshot[]): number[] {
  const returns: number[] = [];

  for (let i = 1; i < snapshots.length; i += 1) {
    const previous = snapshots[i - 1].totalValue;
    const current = snapshots[i].totalValue;

    if (previous <= 0) {
      continue;
    }

    returns.push(current / previous - 1);
  }

  return returns;
}

function computeTwr(snapshots: ValuationSnapshot[]): number {
  const returns = periodReturns(snapshots);
  if (returns.length === 0) {
    return 0;
  }

  return returns.reduce((acc, current) => acc * (1 + current), 1) - 1;
}

function computeMaxDrawdown(snapshots: ValuationSnapshot[]): number {
  if (snapshots.length === 0) {
    return 0;
  }

  let peak = snapshots[0].totalValue;
  let maxDrawdown = 0;

  for (const snapshot of snapshots) {
    if (snapshot.totalValue > peak) {
      peak = snapshot.totalValue;
    }

    if (peak <= 0) {
      continue;
    }

    const drawdown = (peak - snapshot.totalValue) / peak;
    if (drawdown > maxDrawdown) {
      maxDrawdown = drawdown;
    }
  }

  return maxDrawdown;
}

function computeRollingVolatility(snapshots: ValuationSnapshot[]): number | null {
  const returns = periodReturns(snapshots);
  const rolling = returns.slice(-ROLLING_VOLATILITY_WINDOW);
  if (rolling.length < 2) {
    return null;
  }

  const mean = rolling.reduce((acc, current) => acc + current, 0) / rolling.length;
  const variance =
    rolling.reduce((acc, current) => acc + (current - mean) ** 2, 0) /
    (rolling.length - 1);
  const standardDeviation = Math.sqrt(variance);

  return standardDeviation * Math.sqrt(252);
}

function npv(rate: number, cashflows: Array<{ amount: number; time: number }>): number {
  return cashflows.reduce((acc, cashflow) => {
    return acc + cashflow.amount / (1 + rate) ** cashflow.time;
  }, 0);
}

function derivativeNpv(rate: number, cashflows: Array<{ amount: number; time: number }>): number {
  return cashflows.reduce((acc, cashflow) => {
    if (cashflow.time === 0) {
      return acc;
    }

    return acc - (cashflow.time * cashflow.amount) / (1 + rate) ** (cashflow.time + 1);
  }, 0);
}

function solveIrr(cashflows: Array<{ amount: number; time: number }>): number {
  let rate = 0.1;

  for (let i = 0; i < 50; i += 1) {
    const value = npv(rate, cashflows);
    if (Math.abs(value) < 1e-8) {
      return rate;
    }

    const derivative = derivativeNpv(rate, cashflows);
    if (Math.abs(derivative) < 1e-10) {
      break;
    }

    const candidate = rate - value / derivative;
    if (candidate <= -0.9999 || !Number.isFinite(candidate)) {
      break;
    }

    rate = candidate;
  }

  let low = -0.9999;
  let high = 10;
  let lowValue = npv(low, cashflows);
  let highValue = npv(high, cashflows);

  if (lowValue * highValue > 0) {
    return 0;
  }

  for (let i = 0; i < 80; i += 1) {
    const mid = (low + high) / 2;
    const midValue = npv(mid, cashflows);
    if (Math.abs(midValue) < 1e-8) {
      return mid;
    }

    if (lowValue * midValue <= 0) {
      high = mid;
      highValue = midValue;
    } else {
      low = mid;
      lowValue = midValue;
    }

    if (Math.abs(high - low) < 1e-8) {
      return (low + high) / 2;
    }
  }

  return (low + high) / 2;
}

function computeMwrIrr(snapshots: ValuationSnapshot[]): number {
  if (snapshots.length < 2) {
    return 0;
  }

  const first = snapshots[0];
  const last = snapshots[snapshots.length - 1];
  if (first.totalValue <= 0 || last.totalValue <= 0) {
    return 0;
  }

  const start = toTimestamp(first.asOf);
  const end = toTimestamp(last.asOf);
  if (end <= start) {
    return 0;
  }

  const millisPerDay = 24 * 60 * 60 * 1000;
  const cashflows = [
    { amount: -first.totalValue, time: 0 },
    { amount: last.totalValue, time: (end - start) / millisPerDay / 365 },
  ];

  return solveIrr(cashflows);
}

export class PerformanceService {
  constructor(
    private readonly valuationHistory: ValuationHistoryPort,
    private readonly benchmarkComparison: BenchmarkComparisonPort,
    private readonly concentrationRisk: ConcentrationRiskPort,
    private readonly metricsRepository: PerformanceMetricsRepositoryPort,
  ) {}

  async computeAndStore(portfolioId: string, asOf: string): Promise<PerformanceMetrics> {
    const snapshots = sortSnapshots(
      await this.valuationHistory.listSnapshots(portfolioId, asOf),
    );

    const twr = computeTwr(snapshots);
    const mwr = computeMwrIrr(snapshots);
    const drawdown = computeMaxDrawdown(snapshots);
    const rollingVolatility = computeRollingVolatility(snapshots);

    const startSnapshot = snapshots[0] ?? null;
    const endSnapshot = snapshots[snapshots.length - 1] ?? null;

    const benchmarkReturn =
      startSnapshot && endSnapshot
        ? await this.benchmarkComparison.computeBenchmarkReturn(
            endSnapshot.currency,
            startSnapshot.asOf,
            endSnapshot.asOf,
          )
        : null;

    const benchmarkSpread = benchmarkReturn === null ? null : twr - benchmarkReturn;

    const concentration =
      endSnapshot === null
        ? null
        : await this.concentrationRisk.computeConcentrationRisk(
            portfolioId,
            endSnapshot.asOf,
            endSnapshot.currency,
            endSnapshot.totalValue,
          );

    const metrics: PerformanceMetrics = {
      portfolioId,
      asOf,
      twr,
      mwr,
      drawdown,
      rollingVolatility,
      benchmarkReturn,
      benchmarkSpread,
      concentrationHhi: concentration?.concentrationHhi ?? null,
      topPositionWeight: concentration?.topPositionWeight ?? null,
    };

    await this.metricsRepository.save(metrics);
    return metrics;
  }
}
