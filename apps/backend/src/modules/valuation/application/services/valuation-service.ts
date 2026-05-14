import type { ValuationSnapshot } from "../../domain/valuation";
import type {
  PositionSourcePort,
  PriceSourcePort,
  ValuationSnapshotRepositoryPort,
} from "../ports/valuation-ports";

export class ValuationService {
  constructor(
    private readonly positions: PositionSourcePort,
    private readonly prices: PriceSourcePort,
    private readonly snapshots: ValuationSnapshotRepositoryPort,
  ) {}

  async runPortfolioValuation(portfolioId: string, asOf: string): Promise<ValuationSnapshot> {
    const positionList = await this.positions.listPositions(portfolioId);

    let totalValue = 0;

    for (const position of positionList) {
      const price = await this.prices.getPrice(position.securityId, asOf);
      if (!price) {
        continue;
      }
      totalValue += price.price * position.quantity;
    }

    const snapshot: ValuationSnapshot = {
      portfolioId,
      asOf,
      totalValue,
      currency: "USD",
    };

    await this.snapshots.save(snapshot);
    return snapshot;
  }
}
