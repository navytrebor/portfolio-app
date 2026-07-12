import type { SecurityPrice } from "../../../pricing-fx/domain/market-data";
import type { FxRate } from "../../../pricing-fx/domain/market-data";
import type {
  PositionSnapshot,
  ReconstructedPosition,
  ValuationSnapshot,
} from "../../domain/valuation";

export interface PositionSourcePort {
  listPositions(portfolioId: string, asOf: string): Promise<ReconstructedPosition[]>;
}

export interface PortfolioBaseCurrencyPort {
  getBaseCurrency(portfolioId: string): Promise<string | null>;
}

export interface PriceSourcePort {
  getPrice(securityId: string, asOf: string): Promise<SecurityPrice | null>;
  getFxRate(fromCurrency: string, toCurrency: string, asOf: string): Promise<FxRate | null>;
}

export interface ValuationSnapshotRepositoryPort {
  savePositions(positionSnapshots: PositionSnapshot[]): Promise<void>;
  saveValuationSnapshot(snapshot: ValuationSnapshot): Promise<void>;
}
