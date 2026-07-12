import { env } from "../config/env";
import type { PortfolioService } from "../modules/portfolio/services/portfolio-service";
import type { PricingFxService } from "../modules/pricing-fx/services/pricing-fx-service";
import type { SecurityMasterService } from "../modules/security-master/services/security-master-service";
import type { ValuationService } from "../modules/valuation/application/services/valuation-service";
import type { PerformanceService } from "../modules/performance/application/services/performance-service";
import type { PricingFxIngestionService } from "../modules/pricing-fx/services/pricing-fx-ingestion-service";
import type { FxPair } from "../modules/pricing-fx/services/pricing-fx-ingestion-service";

type JobName = "pricing-sync" | "eod-valuation" | "analytics-refresh";

type WorkflowLogger = {
  info(payload: unknown, message?: string): void;
  warn(payload: unknown, message?: string): void;
  error(payload: unknown, message?: string): void;
};

type WorkflowOptions = {
  runOnStart: boolean;
  pricingSyncIntervalMs: number;
  valuationIntervalMs: number;
  analyticsIntervalMs: number;
  valuationEodUtcHour: number;
};

const defaultLogger: WorkflowLogger = {
  info: (_payload, _message) => undefined,
  warn: (_payload, _message) => undefined,
  error: (_payload, _message) => undefined,
};

function currentUtcDateString(): string {
  return new Date().toISOString().slice(0, 10);
}

function buildAsOfTimestamp(date: string, utcHour: number): string {
  const safeHour = Math.max(0, Math.min(23, utcHour));
  const hour = String(safeHour).padStart(2, "0");
  return `${date}T${hour}:00:00.000Z`;
}

function unique<T>(items: T[]): T[] {
  return Array.from(new Set(items));
}

export class BackgroundWorkflowOrchestrator {
  private timers: NodeJS.Timeout[] = [];
  private started = false;
  private readonly running = new Set<JobName>();
  private logger: WorkflowLogger;

  constructor(
    private readonly pricingIngestion: PricingFxIngestionService,
    private readonly valuationService: ValuationService,
    private readonly performanceService: PerformanceService,
    private readonly portfolioService: PortfolioService,
    private readonly pricingFxService: PricingFxService,
    private readonly securityService: SecurityMasterService,
    logger: WorkflowLogger = defaultLogger,
    private readonly options: WorkflowOptions = {
      runOnStart: env.BACKGROUND_WORKFLOWS_RUN_ON_START,
      pricingSyncIntervalMs: env.PRICING_SYNC_INTERVAL_SECONDS * 1000,
      valuationIntervalMs: env.VALUATION_EOD_INTERVAL_SECONDS * 1000,
      analyticsIntervalMs: env.ANALYTICS_REFRESH_INTERVAL_SECONDS * 1000,
      valuationEodUtcHour: env.VALUATION_EOD_UTC_HOUR,
    },
  ) {
    this.logger = logger;
  }

  setLogger(logger: WorkflowLogger): void {
    this.logger = logger;
  }

  async start(): Promise<void> {
    if (this.started) {
      return;
    }

    this.started = true;

    if (this.options.runOnStart) {
      await this.runAllOnce();
    }

    this.timers.push(
      setInterval(() => {
        void this.runPricingSync().catch(() => undefined);
      }, this.options.pricingSyncIntervalMs),
    );

    this.timers.push(
      setInterval(() => {
        void this.runEndOfDayValuations().catch(() => undefined);
      }, this.options.valuationIntervalMs),
    );

    this.timers.push(
      setInterval(() => {
        void this.runAnalyticsRefresh().catch(() => undefined);
      }, this.options.analyticsIntervalMs),
    );

    this.logger.info(
      {
        pricingSyncIntervalMs: this.options.pricingSyncIntervalMs,
        valuationIntervalMs: this.options.valuationIntervalMs,
        analyticsIntervalMs: this.options.analyticsIntervalMs,
        runOnStart: this.options.runOnStart,
      },
      "background workflows started",
    );
  }

  async stop(): Promise<void> {
    for (const timer of this.timers) {
      clearInterval(timer);
    }

    this.timers = [];
    this.started = false;
    this.logger.info({}, "background workflows stopped");
  }

  async runAllOnce(): Promise<void> {
    await this.runPricingSync();
    await this.runEndOfDayValuations();
    await this.runAnalyticsRefresh();
  }

  private async resolveAsOfDate(): Promise<string> {
    const currentDate = currentUtcDateString();
    const latestMarketDate = await this.pricingFxService.getLatestMarketDataAsOfDate();

    if (!latestMarketDate) {
      return currentDate;
    }

    return latestMarketDate > currentDate ? latestMarketDate : currentDate;
  }

  private async withJobLock(name: JobName, fn: () => Promise<void>): Promise<void> {
    if (this.running.has(name)) {
      this.logger.warn({ job: name }, "background workflow already running; skipping tick");
      return;
    }

    this.running.add(name);
    try {
      await fn();
      this.logger.info({ job: name }, "background workflow tick completed");
    } catch (error) {
      this.logger.error({ job: name, error }, "background workflow tick failed");
      throw error;
    } finally {
      this.running.delete(name);
    }
  }

  private async runPricingSync(): Promise<void> {
    await this.withJobLock("pricing-sync", async () => {
      const asOfDate = await this.resolveAsOfDate();
      const [portfolios, securities] = await Promise.all([
        this.portfolioService.listAllPortfolios(),
        this.securityService.listSecurities(),
      ]);

      const securityIds = unique(securities.map((security) => security.id));
      const securityCurrencies = unique(securities.map((security) => security.currency));
      const portfolioCurrencies = unique(portfolios.map((portfolio) => portfolio.baseCurrency));

      const fxPairs: FxPair[] = [];
      for (const fromCurrency of securityCurrencies) {
        for (const toCurrency of portfolioCurrencies) {
          if (fromCurrency === toCurrency) {
            continue;
          }
          fxPairs.push({ fromCurrency, toCurrency });
        }
      }

      if (securityIds.length === 0) {
        this.logger.warn({ asOfDate }, "pricing sync skipped: no securities found");
        return;
      }

      const result = await this.pricingIngestion.runJob({
        asOfDate,
        source: env.PRICING_FX_JOB_SOURCE,
        securityIds,
        fxPairs,
        securityPriceSlaHours: env.PRICING_PRICE_SLA_HOURS,
        fxRateSlaHours: env.PRICING_FX_SLA_HOURS,
      });

      this.logger.info(
        {
          asOfDate,
          securities: securityIds.length,
          fxPairs: fxPairs.length,
          result,
        },
        "pricing sync completed",
      );
    });
  }

  private async runEndOfDayValuations(): Promise<void> {
    await this.withJobLock("eod-valuation", async () => {
      const asOfDate = await this.resolveAsOfDate();
      const asOf = buildAsOfTimestamp(asOfDate, this.options.valuationEodUtcHour);
      const portfolios = await this.portfolioService.listAllPortfolios();

      for (const portfolio of portfolios) {
        await this.valuationService.runPortfolioValuation(portfolio.id, asOf);
      }

      this.logger.info(
        { asOf, portfoliosProcessed: portfolios.length },
        "end-of-day valuation snapshots completed",
      );
    });
  }

  private async runAnalyticsRefresh(): Promise<void> {
    await this.withJobLock("analytics-refresh", async () => {
      const asOfDate = await this.resolveAsOfDate();
      const asOf = buildAsOfTimestamp(asOfDate, this.options.valuationEodUtcHour);
      const portfolios = await this.portfolioService.listAllPortfolios();

      for (const portfolio of portfolios) {
        await this.performanceService.computeAndStore(portfolio.id, asOf);
      }

      this.logger.info(
        { asOf, portfoliosProcessed: portfolios.length },
        "analytics cache refresh completed",
      );
    });
  }
}
