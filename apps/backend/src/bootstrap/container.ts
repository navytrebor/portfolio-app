import { InMemoryUserRepository } from "../modules/identity/adapters/in-memory-user-repository";
import { IdentityService } from "../modules/identity/services/identity-service";
import { InMemoryPortfolioRepository } from "../modules/portfolio/adapters/in-memory-portfolio-repository";
import { PortfolioService } from "../modules/portfolio/services/portfolio-service";
import { InMemorySecurityRepository } from "../modules/security-master/adapters/in-memory-security-repository";
import { SecurityMasterService } from "../modules/security-master/services/security-master-service";
import { InMemoryPricingFxRepository } from "../modules/pricing-fx/adapters/in-memory-pricing-fx-repository";
import { PricingFxService } from "../modules/pricing-fx/services/pricing-fx-service";
import { InMemoryIdempotencyStore } from "../modules/trade-registry/adapters/in-memory-idempotency-store";
import { InMemoryTradeRepository } from "../modules/trade-registry/adapters/in-memory-trade-repository";
import { TradeRegistryService } from "../modules/trade-registry/application/services/trade-registry-service";
import {
  InMemoryPositionSource,
  InMemoryPriceSource,
  InMemoryValuationSnapshotRepository,
} from "../modules/valuation/adapters/in-memory-valuation-adapters";
import { ValuationService } from "../modules/valuation/application/services/valuation-service";
import {
  InMemoryPerformanceMetricsRepository,
  InMemoryValuationHistory,
} from "../modules/performance/adapters/in-memory-performance-adapters";
import { PerformanceService } from "../modules/performance/application/services/performance-service";

export type AppContainer = {
  identityService: IdentityService;
  portfolioService: PortfolioService;
  securityMasterService: SecurityMasterService;
  pricingFxService: PricingFxService;
  tradeRegistryService: TradeRegistryService;
  valuationService: ValuationService;
  performanceService: PerformanceService;
};

export function buildContainer(): AppContainer {
  const identityService = new IdentityService(new InMemoryUserRepository());
  const portfolioService = new PortfolioService(new InMemoryPortfolioRepository());
  const securityMasterService = new SecurityMasterService(
    new InMemorySecurityRepository(),
  );

  const pricingFxService = new PricingFxService(new InMemoryPricingFxRepository());

  const tradeRegistryService = new TradeRegistryService(
    new InMemoryTradeRepository(),
    new InMemoryIdempotencyStore(),
  );

  const valuationService = new ValuationService(
    new InMemoryPositionSource(),
    new InMemoryPriceSource(),
    new InMemoryValuationSnapshotRepository(),
  );

  const performanceService = new PerformanceService(
    new InMemoryValuationHistory(),
    new InMemoryPerformanceMetricsRepository(),
  );

  return {
    identityService,
    portfolioService,
    securityMasterService,
    pricingFxService,
    tradeRegistryService,
    valuationService,
    performanceService,
  };
}
