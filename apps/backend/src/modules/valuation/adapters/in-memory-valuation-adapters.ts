import type { PositionSnapshot, ValuationSnapshot } from "../domain/valuation";
import type {
  PositionSourcePort,
  PriceSourcePort,
  ValuationSnapshotRepositoryPort,
} from "../application/ports/valuation-ports";
import type { SecurityPrice } from "../../pricing-fx/domain/market-data";

export class InMemoryPositionSource implements PositionSourcePort {
  async listPositions(_portfolioId: string): Promise<PositionSnapshot[]> {
    return [];
  }
}

export class InMemoryPriceSource implements PriceSourcePort {
  async getPrice(_securityId: string, _asOf: string): Promise<SecurityPrice | null> {
    return null;
  }
}

export class InMemoryValuationSnapshotRepository
  implements ValuationSnapshotRepositoryPort
{
  private readonly snapshots: ValuationSnapshot[] = [];

  async save(snapshot: ValuationSnapshot): Promise<void> {
    this.snapshots.push(snapshot);
  }
}
