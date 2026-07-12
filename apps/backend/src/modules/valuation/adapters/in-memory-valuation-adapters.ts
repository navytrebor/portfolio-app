import type {
  PositionSnapshot,
  ReconstructedPosition,
  ValuationSnapshot,
} from "../domain/valuation";
import type {
  PortfolioBaseCurrencyPort,
  PositionSourcePort,
  PriceSourcePort,
  ValuationSnapshotRepositoryPort,
} from "../application/ports/valuation-ports";
import type { FxRate, SecurityPrice } from "../../pricing-fx/domain/market-data";

export class InMemoryPositionSource implements PositionSourcePort {
  async listPositions(_portfolioId: string, _asOf: string): Promise<ReconstructedPosition[]> {
    return [];
  }
}

export class InMemoryPortfolioBaseCurrencySource
  implements PortfolioBaseCurrencyPort
{
  async getBaseCurrency(_portfolioId: string): Promise<string | null> {
    return "USD";
  }
}

export class InMemoryPriceSource implements PriceSourcePort {
  async getPrice(_securityId: string, _asOf: string): Promise<SecurityPrice | null> {
    return null;
  }

  async getFxRate(
    _fromCurrency: string,
    _toCurrency: string,
    _asOf: string,
  ): Promise<FxRate | null> {
    return null;
  }
}

export class InMemoryValuationSnapshotRepository
  implements ValuationSnapshotRepositoryPort
{
  private readonly positionSnapshots: PositionSnapshot[] = [];
  private readonly snapshots: ValuationSnapshot[] = [];

  async savePositions(positionSnapshots: PositionSnapshot[]): Promise<void> {
    this.positionSnapshots.push(...positionSnapshots);
  }

  async saveValuationSnapshot(snapshot: ValuationSnapshot): Promise<void> {
    this.snapshots.push(snapshot);
  }
}
