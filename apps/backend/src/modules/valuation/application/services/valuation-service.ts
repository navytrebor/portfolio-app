import type { PositionSnapshot, ValuationSnapshot } from "../../domain/valuation";
import type {
  PortfolioBaseCurrencyPort,
  PositionSourcePort,
  PriceSourcePort,
  ValuationSnapshotRepositoryPort,
} from "../ports/valuation-ports";

export class ValuationService {
  constructor(
    private readonly portfolios: PortfolioBaseCurrencyPort,
    private readonly positions: PositionSourcePort,
    private readonly prices: PriceSourcePort,
    private readonly snapshots: ValuationSnapshotRepositoryPort,
  ) {}

  private async convertToBaseCurrency(
    amount: number,
    fromCurrency: string,
    toCurrency: string,
    asOf: string,
  ): Promise<number> {
    if (fromCurrency === toCurrency) {
      return amount;
    }

    const fxRate = await this.prices.getFxRate(fromCurrency, toCurrency, asOf);
    if (!fxRate) {
      throw new Error(
        `Missing FX rate for pair ${fromCurrency}/${toCurrency} at as-of ${asOf}`,
      );
    }

    return amount * fxRate.rate;
  }

  async runPortfolioValuation(portfolioId: string, asOf: string): Promise<ValuationSnapshot> {
    const baseCurrency = await this.portfolios.getBaseCurrency(portfolioId);
    if (!baseCurrency) {
      throw new Error(`Portfolio not found: ${portfolioId}`);
    }

    const positionList = await this.positions.listPositions(portfolioId, asOf);
    const snapshotsToPersist: PositionSnapshot[] = [];

    let securitiesValue = 0;

    for (const position of positionList) {
      const price = await this.prices.getPrice(position.securityId, asOf);
      if (!price) {
        throw new Error(
          `Missing security price for ${position.securityId} at as-of ${asOf}`,
        );
      }

      const marketValue = price.price * position.quantity;
      const converted = await this.convertToBaseCurrency(
        marketValue,
        price.currency,
        baseCurrency,
        asOf,
      );

      snapshotsToPersist.push({
        portfolioId,
        securityId: position.securityId,
        asOf,
        quantity: position.quantity,
        averageCost: position.averageCost,
        marketValue,
        currency: position.currency,
      });

      securitiesValue += converted;
    }

    const cashValue = 0;
    const totalValue = securitiesValue + cashValue;

    const snapshot: ValuationSnapshot = {
      portfolioId,
      asOf,
      securitiesValue,
      cashValue,
      totalValue,
      currency: baseCurrency,
    };

    await this.snapshots.savePositions(snapshotsToPersist);
    await this.snapshots.saveValuationSnapshot(snapshot);
    return snapshot;
  }
}
