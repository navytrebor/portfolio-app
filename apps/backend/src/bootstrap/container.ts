import { PostgresUserRepository } from "../modules/identity/adapters/postgres-user-repository";
import { IdentityService } from "../modules/identity/services/identity-service";
import { PostgresPortfolioRepository } from "../modules/portfolio/adapters/postgres-portfolio-repository";
import { PortfolioService } from "../modules/portfolio/services/portfolio-service";
import { PostgresSecurityRepository } from "../modules/security-master/adapters/postgres-security-repository";
import { SecurityMasterService } from "../modules/security-master/services/security-master-service";
import { PostgresPricingFxRepository } from "../modules/pricing-fx/adapters/postgres-pricing-fx-repository";
import { PricingFxService } from "../modules/pricing-fx/services/pricing-fx-service";
import { PostgresIdempotencyStore } from "../modules/trade-registry/adapters/postgres-idempotency-store";
import { PostgresTradeRepository } from "../modules/trade-registry/adapters/postgres-trade-repository";
import { TradeRegistryService } from "../modules/trade-registry/application/services/trade-registry-service";
import {
  PortfolioBaseCurrencySource,
  PostgresValuationSnapshotRepository,
  PricingFxMarketDataSource,
  TradeLedgerPositionSource,
} from "../modules/valuation/adapters/postgres-valuation-adapters";
import { ValuationService } from "../modules/valuation/application/services/valuation-service";
import {
  InMemoryPerformanceMetricsRepository,
  InMemoryValuationHistory,
} from "../modules/performance/adapters/in-memory-performance-adapters";
import { PerformanceService } from "../modules/performance/application/services/performance-service";
import { postgresPool } from "../db/postgres-pool";
import { env } from "../config/env";

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
  const identityService = new IdentityService(new PostgresUserRepository(postgresPool));
  const portfolioRepository = new PostgresPortfolioRepository(postgresPool);
  const portfolioService = new PortfolioService(portfolioRepository);
  const securityMasterService = new SecurityMasterService(
    new PostgresSecurityRepository(postgresPool),
  );

  const pricingFxRepository = new PostgresPricingFxRepository(postgresPool);
  const pricingFxService = new PricingFxService(pricingFxRepository);

  const tradeRepository = new PostgresTradeRepository(postgresPool);

  const tradeRegistryService = new TradeRegistryService(
    tradeRepository,
    new PostgresIdempotencyStore(postgresPool),
    env.IDEMPOTENCY_TTL_HOURS,
  );

  const valuationService = new ValuationService(
    new PortfolioBaseCurrencySource(portfolioRepository),
    new TradeLedgerPositionSource(tradeRepository),
    new PricingFxMarketDataSource(pricingFxRepository),
    new PostgresValuationSnapshotRepository(postgresPool),
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
