import type { SecurityPrice } from "../../../pricing-fx/domain/market-data";
import type { PositionSnapshot, ValuationSnapshot } from "../../domain/valuation";

export interface PositionSourcePort {
  listPositions(portfolioId: string): Promise<PositionSnapshot[]>;
}

export interface PriceSourcePort {
  getPrice(securityId: string, asOf: string): Promise<SecurityPrice | null>;
}

export interface ValuationSnapshotRepositoryPort {
  save(snapshot: ValuationSnapshot): Promise<void>;
}
