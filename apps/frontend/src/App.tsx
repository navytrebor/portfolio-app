import { useEffect, useMemo, useState } from "react";
import type {
  AuthLoginInitiateResponse,
  AuthSessionResponse,
  AuthUser,
  UserRole,
} from "@portfolio/contracts";
import { apiBaseUrl, apiRequest, ApiRequestError } from "./api";

type Portfolio = {
  id: string;
  name: string;
  baseCurrency: string;
};

type Security = {
  id: string;
  ticker: string;
  securityType: string;
  currency: string;
};

type Trade = {
  id: string;
  portfolioId: string;
  securityId: string;
  side: "BUY" | "SELL";
  quantity: number;
  price: number;
  tradeDate: string;
  currency: string;
};

type ValuationSnapshot = {
  portfolioId: string;
  asOf: string;
  totalValue: number;
  securitiesValue: number;
  cashValue: number;
  currency: string;
};

type PerformanceSnapshot = {
  asOf: string;
  twr: number;
  mwr: number;
  drawdown: number;
  rollingVolatility: number | null;
  benchmarkSpread: number | null;
  concentrationHhi: number | null;
  topPositionWeight: number | null;
};

type PaginatedResponse<T> = {
  items: T[];
  page: {
    limit: number;
    offset: number;
    total: number;
    returned: number;
    hasMore: boolean;
  };
};

type OverviewData = {
  portfolios: PaginatedResponse<Portfolio>;
  securities: PaginatedResponse<Security>;
  trades: PaginatedResponse<Trade>;
};

type NavItem = {
  id: string;
  label: string;
  roles: UserRole[];
  summary: string;
};

type AuthStepState =
  | { kind: "idle" }
  | { kind: "enroll"; payload: AuthLoginInitiateResponse }
  | { kind: "verify"; payload: AuthLoginInitiateResponse };

const SESSION_STORAGE_KEY = "portfolio-app.session-token";
const EMAIL_OPTIONS = ["alice@example.com", "bob@example.com", "carol@example.com"];
const ALL_ROLES: UserRole[] = ["ADMIN", "TRADER", "ANALYST", "VIEWER"];

const NAV_ITEMS: NavItem[] = [
  {
    id: "overview",
    label: "Overview",
    roles: ALL_ROLES,
    summary: "Connection status and protected API summary.",
  },
  {
    id: "portfolios",
    label: "Portfolios",
    roles: ALL_ROLES,
    summary: "Role-scoped portfolio access from /api/v1/portfolios.",
  },
  {
    id: "securities",
    label: "Securities",
    roles: ALL_ROLES,
    summary: "Reference data from the security master endpoint.",
  },
  {
    id: "trades",
    label: "Trades",
    roles: ALL_ROLES,
    summary: "Recent ledger activity with later trade capture actions layered on top.",
  },
  {
    id: "valuation",
    label: "Valuation",
    roles: ["ADMIN", "ANALYST"],
    summary: "On-demand valuation workflow for the selected portfolio.",
  },
  {
    id: "performance",
    label: "Performance",
    roles: ["ADMIN", "ANALYST"],
    summary: "Analytics refresh using the advanced backend metrics engine.",
  },
  {
    id: "admin",
    label: "Access",
    roles: ["ADMIN"],
    summary: "Admin-only role visibility and operating notes.",
  },
];

function readSessionToken(): string | null {
  return window.localStorage.getItem(SESSION_STORAGE_KEY);
}

function writeSessionToken(token: string) {
  window.localStorage.setItem(SESSION_STORAGE_KEY, token);
}

function clearSessionToken() {
  window.localStorage.removeItem(SESSION_STORAGE_KEY);
}

function formatApiError(error: unknown): string {
  if (error instanceof ApiRequestError) {
    return error.requestId
      ? `${error.message} (request ${error.requestId})`
      : error.message;
  }

  if (error instanceof Error) {
    return error.message;
  }

  return "Unexpected error";
}

function formatAsOf(date = new Date()): string {
  return `${date.toISOString().slice(0, 10)}T17:00:00.000Z`;
}

function formatNumber(value: number | null | undefined): string {
  if (typeof value !== "number") {
    return "—";
  }

  return value.toLocaleString(undefined, {
    maximumFractionDigits: 2,
  });
}

function formatPercent(value: number | null | undefined): string {
  if (typeof value !== "number") {
    return "—";
  }

  return `${(value * 100).toFixed(2)}%`;
}

function AppHeader({
  user,
  onLogout,
}: {
  user: AuthUser;
  onLogout: () => void;
}) {
  return (
    <header className="shell-header">
      <div>
        <p className="eyebrow">Authenticated shell</p>
        <h1>Portfolio Platform</h1>
        <p className="subtle">
          Signed in as <strong>{user.email}</strong> with the <strong>{user.role}</strong> role.
        </p>
      </div>

      <div className="header-actions">
        <span className={`role-badge role-${user.role.toLowerCase()}`}>{user.role}</span>
        <button className="ghost-button" onClick={onLogout} type="button">
          Sign out
        </button>
      </div>
    </header>
  );
}

function LoginScreen({
  email,
  emailError,
  isSubmitting,
  authStep,
  onEmailChange,
  onStartLogin,
  onCompleteStep,
}: {
  email: string;
  emailError: string | null;
  isSubmitting: boolean;
  authStep: AuthStepState;
  onEmailChange: (value: string) => void;
  onStartLogin: () => void;
  onCompleteStep: (code: string) => void;
}) {
  const [code, setCode] = useState("");
  const [codeError, setCodeError] = useState<string | null>(null);

  useEffect(() => {
    setCode("");
    setCodeError(null);
  }, [authStep.kind]);

  const currentUser = authStep.kind === "idle" ? null : authStep.payload.user;

  return (
    <main className="auth-layout">
      <section className="auth-panel hero-panel">
        <p className="eyebrow">Phase 4 · Step 1</p>
        <h1>Authenticate into the portfolio shell</h1>
        <p>
          This flow uses real backend APIs for login challenge creation, MFA enrollment,
          MFA verification, and protected session bootstrap.
        </p>

        <div className="hint-card">
          <h2>Deterministic local users</h2>
          <ul>
            <li><strong>alice@example.com</strong> — ADMIN</li>
            <li><strong>bob@example.com</strong> — ANALYST</li>
            <li><strong>carol@example.com</strong> — TRADER</li>
          </ul>
          <p className="subtle">First login triggers MFA enrollment. Later logins ask only for the 6-digit code.</p>
        </div>
      </section>

      <section className="auth-panel form-panel">
        <div className="field-group">
          <label htmlFor="email">Email</label>
          <input
            id="email"
            className="text-input"
            list="local-users"
            value={email}
            onChange={(event) => onEmailChange(event.target.value)}
            placeholder="alice@example.com"
            disabled={authStep.kind !== "idle" || isSubmitting}
          />
          <datalist id="local-users">
            {EMAIL_OPTIONS.map((option) => (
              <option key={option} value={option} />
            ))}
          </datalist>
          {emailError ? <p className="field-error">{emailError}</p> : null}
        </div>

        {authStep.kind === "idle" ? (
          <button className="primary-button" onClick={onStartLogin} type="button" disabled={isSubmitting}>
            {isSubmitting ? "Starting login..." : "Start login"}
          </button>
        ) : null}

        {authStep.kind === "enroll" ? (
          <div className="step-panel">
            <h2>Enroll MFA</h2>
            <p>
              Save the secret below in an authenticator app, then enter the current 6-digit code
              for <strong>{currentUser?.email}</strong>.
            </p>
            <dl className="secret-grid">
              <div>
                <dt>Shared secret</dt>
                <dd><code>{authStep.payload.mfaSecret}</code></dd>
              </div>
              <div>
                <dt>OTP Auth URI</dt>
                <dd className="secret-uri"><code>{authStep.payload.otpAuthUrl}</code></dd>
              </div>
              <div>
                <dt>Expires</dt>
                <dd>{new Date(authStep.payload.expiresAt).toLocaleString()}</dd>
              </div>
            </dl>

            <div className="field-group">
              <label htmlFor="mfa-enroll-code">Authenticator code</label>
              <input
                id="mfa-enroll-code"
                className="text-input"
                inputMode="numeric"
                maxLength={6}
                value={code}
                onChange={(event) => setCode(event.target.value.replace(/\D+/g, "").slice(0, 6))}
                placeholder="123456"
              />
              {codeError ? <p className="field-error">{codeError}</p> : null}
            </div>

            <button
              className="primary-button"
              type="button"
              disabled={isSubmitting}
              onClick={() => {
                if (!/^\d{6}$/.test(code)) {
                  setCodeError("Enter the 6-digit authenticator code.");
                  return;
                }
                setCodeError(null);
                onCompleteStep(code);
              }}
            >
              {isSubmitting ? "Completing enrollment..." : "Complete enrollment"}
            </button>
          </div>
        ) : null}

        {authStep.kind === "verify" ? (
          <div className="step-panel">
            <h2>Verify MFA</h2>
            <p>
              Enter the current authenticator code for <strong>{currentUser?.email}</strong>.
            </p>

            <div className="field-group">
              <label htmlFor="mfa-verify-code">Authenticator code</label>
              <input
                id="mfa-verify-code"
                className="text-input"
                inputMode="numeric"
                maxLength={6}
                value={code}
                onChange={(event) => setCode(event.target.value.replace(/\D+/g, "").slice(0, 6))}
                placeholder="123456"
              />
              {codeError ? <p className="field-error">{codeError}</p> : null}
            </div>

            <button
              className="primary-button"
              type="button"
              disabled={isSubmitting}
              onClick={() => {
                if (!/^\d{6}$/.test(code)) {
                  setCodeError("Enter the 6-digit authenticator code.");
                  return;
                }
                setCodeError(null);
                onCompleteStep(code);
              }}
            >
              {isSubmitting ? "Verifying..." : "Verify and sign in"}
            </button>
          </div>
        ) : null}
      </section>
    </main>
  );
}

function DataCard({
  title,
  value,
  hint,
}: {
  title: string;
  value: string;
  hint: string;
}) {
  return (
    <article className="metric-card">
      <p className="eyebrow">{title}</p>
      <h3>{value}</h3>
      <p className="subtle">{hint}</p>
    </article>
  );
}

function EmptyState({ title, description }: { title: string; description: string }) {
  return (
    <div className="empty-state">
      <h3>{title}</h3>
      <p>{description}</p>
    </div>
  );
}

export function App() {
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [email, setEmail] = useState(EMAIL_OPTIONS[0]);
  const [authError, setAuthError] = useState<string | null>(null);
  const [authStep, setAuthStep] = useState<AuthStepState>({ kind: "idle" });
  const [isAuthSubmitting, setIsAuthSubmitting] = useState(false);
  const [activeNavId, setActiveNavId] = useState("overview");
  const [overviewData, setOverviewData] = useState<OverviewData | null>(null);
  const [overviewError, setOverviewError] = useState<string | null>(null);
  const [isOverviewLoading, setIsOverviewLoading] = useState(false);
  const [selectedPortfolioId, setSelectedPortfolioId] = useState("");
  const [valuationResult, setValuationResult] = useState<ValuationSnapshot | null>(null);
  const [performanceResult, setPerformanceResult] = useState<PerformanceSnapshot | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [isValuationRunning, setIsValuationRunning] = useState(false);
  const [isPerformanceRunning, setIsPerformanceRunning] = useState(false);

  const visibleNavItems = useMemo(
    () => NAV_ITEMS.filter((item) => (user ? item.roles.includes(user.role) : false)),
    [user],
  );

  useEffect(() => {
    const storedToken = readSessionToken();
    if (!storedToken) {
      setAuthChecked(true);
      return;
    }

    void (async () => {
      try {
        const response = await apiRequest<{ user: AuthUser }>("/api/v1/auth/me", {
          method: "GET",
          token: storedToken,
        });
        setToken(storedToken);
        setUser(response.user);
      } catch {
        clearSessionToken();
      } finally {
        setAuthChecked(true);
      }
    })();
  }, []);

  useEffect(() => {
    if (!token || !user) {
      return;
    }

    void (async () => {
      setIsOverviewLoading(true);
      setOverviewError(null);
      try {
        const [portfolios, securities, trades] = await Promise.all([
          apiRequest<PaginatedResponse<Portfolio>>("/api/v1/portfolios?limit=5&offset=0", {
            method: "GET",
            token,
          }),
          apiRequest<PaginatedResponse<Security>>("/api/v1/securities?limit=5&offset=0", {
            method: "GET",
            token,
          }),
          apiRequest<PaginatedResponse<Trade>>("/api/v1/trades?limit=5&offset=0", {
            method: "GET",
            token,
          }),
        ]);

        setOverviewData({ portfolios, securities, trades });
        setSelectedPortfolioId((current) => current || portfolios.items[0]?.id || "");
      } catch (error) {
        setOverviewError(formatApiError(error));
      } finally {
        setIsOverviewLoading(false);
      }
    })();
  }, [token, user]);

  useEffect(() => {
    if (visibleNavItems.length > 0 && !visibleNavItems.some((item) => item.id === activeNavId)) {
      setActiveNavId(visibleNavItems[0].id);
    }
  }, [activeNavId, visibleNavItems]);

  const activeNav = visibleNavItems.find((item) => item.id === activeNavId) ?? visibleNavItems[0] ?? null;
  const selectedPortfolio = overviewData?.portfolios.items.find((portfolio) => portfolio.id === selectedPortfolioId) ?? null;

  async function finalizeSession(session: AuthSessionResponse) {
    writeSessionToken(session.token);
    setToken(session.token);
    setUser(session.user);
    setAuthStep({ kind: "idle" });
    setAuthError(null);
    setValuationResult(null);
    setPerformanceResult(null);
    setActionError(null);
  }

  async function handleStartLogin() {
    const normalizedEmail = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
      setAuthError("Enter a valid email address.");
      return;
    }

    setIsAuthSubmitting(true);
    setAuthError(null);

    try {
      const response = await apiRequest<AuthLoginInitiateResponse>("/api/v1/auth/login/initiate", {
        method: "POST",
        body: JSON.stringify({ email: normalizedEmail }),
      });

      setEmail(normalizedEmail);
      setAuthStep(
        response.nextStep === "MFA_ENROLL"
          ? { kind: "enroll", payload: response }
          : { kind: "verify", payload: response },
      );
    } catch (error) {
      setAuthError(formatApiError(error));
    } finally {
      setIsAuthSubmitting(false);
    }
  }

  async function handleCompleteAuthStep(code: string) {
    if (authStep.kind === "idle") {
      return;
    }

    setIsAuthSubmitting(true);
    setAuthError(null);
    try {
      const session =
        authStep.kind === "enroll"
          ? await apiRequest<AuthSessionResponse>("/api/v1/auth/mfa/enroll", {
              method: "POST",
              body: JSON.stringify({
                enrollmentToken: authStep.payload.enrollmentToken,
                code,
              }),
            })
          : await apiRequest<AuthSessionResponse>("/api/v1/auth/login/verify", {
              method: "POST",
              body: JSON.stringify({
                challengeToken: authStep.payload.challengeToken,
                code,
              }),
            });

      await finalizeSession(session);
    } catch (error) {
      setAuthError(formatApiError(error));
    } finally {
      setIsAuthSubmitting(false);
    }
  }

  async function handleLogout() {
    if (token) {
      try {
        await apiRequest<{ ok: boolean }>("/api/v1/auth/logout", {
          method: "POST",
          token,
        });
      } catch {
        // Client-side token reset is authoritative for the current MVP shell.
      }
    }

    clearSessionToken();
    setToken(null);
    setUser(null);
    setOverviewData(null);
    setSelectedPortfolioId("");
    setValuationResult(null);
    setPerformanceResult(null);
    setActionError(null);
    setAuthError(null);
    setAuthStep({ kind: "idle" });
  }

  async function runValuation() {
    if (!token || !selectedPortfolioId) {
      return;
    }

    setIsValuationRunning(true);
    setActionError(null);
    try {
      const response = await apiRequest<ValuationSnapshot>("/api/v1/valuations/run", {
        method: "POST",
        token,
        body: JSON.stringify({
          portfolioId: selectedPortfolioId,
          asOf: formatAsOf(),
        }),
      });
      setValuationResult(response);
    } catch (error) {
      setActionError(formatApiError(error));
    } finally {
      setIsValuationRunning(false);
    }
  }

  async function runPerformance() {
    if (!token || !selectedPortfolioId) {
      return;
    }

    setIsPerformanceRunning(true);
    setActionError(null);
    try {
      const response = await apiRequest<PerformanceSnapshot>("/api/v1/analytics/performance/run", {
        method: "POST",
        token,
        body: JSON.stringify({
          portfolioId: selectedPortfolioId,
          asOf: formatAsOf(),
        }),
      });
      setPerformanceResult(response);
    } catch (error) {
      setActionError(formatApiError(error));
    } finally {
      setIsPerformanceRunning(false);
    }
  }

  if (!authChecked) {
    return <main className="loading-screen">Checking saved session…</main>;
  }

  if (!user || !token) {
    return (
      <>
        <LoginScreen
          email={email}
          emailError={authError}
          isSubmitting={isAuthSubmitting}
          authStep={authStep}
          onEmailChange={(value) => {
            setEmail(value);
            setAuthError(null);
          }}
          onStartLogin={() => {
            void handleStartLogin();
          }}
          onCompleteStep={(code) => {
            void handleCompleteAuthStep(code);
          }}
        />
        <footer className="app-footer">
          <span>Backend: {apiBaseUrl}</span>
          <span>MFA and auth are backed by real <code>/api/v1/auth/*</code> endpoints.</span>
        </footer>
      </>
    );
  }

  return (
    <main className="shell-layout">
      <AppHeader user={user} onLogout={() => void handleLogout()} />

      <div className="shell-grid">
        <aside className="side-nav">
          <h2>Workspace</h2>
          <nav>
            {visibleNavItems.map((item) => (
              <button
                key={item.id}
                type="button"
                className={item.id === activeNav?.id ? "nav-link active" : "nav-link"}
                onClick={() => setActiveNavId(item.id)}
              >
                <span>{item.label}</span>
                <small>{item.summary}</small>
              </button>
            ))}
          </nav>

          <div className="hint-card compact">
            <h3>Role-aware shell</h3>
            <p>
              Navigation is filtered from the authenticated user role returned by
              <code> /api/v1/auth/me</code>.
            </p>
          </div>
        </aside>

        <section className="content-panel">
          <header className="section-header">
            <div>
              <p className="eyebrow">{activeNav?.label ?? "Workspace"}</p>
              <h2>{activeNav?.summary ?? "Protected frontend workspace"}</h2>
            </div>

            <div className="portfolio-picker">
              <label htmlFor="portfolio-select">Portfolio</label>
              <select
                id="portfolio-select"
                value={selectedPortfolioId}
                onChange={(event) => setSelectedPortfolioId(event.target.value)}
                disabled={!overviewData || overviewData.portfolios.items.length === 0}
              >
                {overviewData?.portfolios.items.map((portfolio) => (
                  <option key={portfolio.id} value={portfolio.id}>
                    {portfolio.name} · {portfolio.baseCurrency}
                  </option>
                ))}
              </select>
            </div>
          </header>

          {overviewError ? <p className="banner error">{overviewError}</p> : null}
          {actionError ? <p className="banner error">{actionError}</p> : null}

          {isOverviewLoading ? (
            <div className="loading-card">Loading protected workspace data…</div>
          ) : null}

          {!isOverviewLoading && overviewData ? (
            <>
              {activeNav?.id === "overview" ? (
                <>
                  <section className="metrics-grid">
                    <DataCard
                      title="Portfolios"
                      value={String(overviewData.portfolios.page.total)}
                      hint="Directly from the authenticated portfolios endpoint."
                    />
                    <DataCard
                      title="Securities"
                      value={String(overviewData.securities.page.total)}
                      hint="Versioned API call with pagination metadata."
                    />
                    <DataCard
                      title="Trades"
                      value={String(overviewData.trades.page.total)}
                      hint="Role-scoped ledger data for the signed-in user."
                    />
                  </section>

                  <section className="action-grid">
                    <article className="action-card">
                      <h3>Session health</h3>
                      <ul>
                        <li><strong>Auth base:</strong> {apiBaseUrl}/api/v1/auth</li>
                        <li><strong>MFA enabled:</strong> {user.mfaEnabled ? "Yes" : "No"}</li>
                        <li><strong>Selected portfolio:</strong> {selectedPortfolio?.name ?? "None"}</li>
                      </ul>
                    </article>

                    <article className="action-card">
                      <h3>Protected actions</h3>
                      <div className="button-row">
                        <button
                          className="primary-button"
                          type="button"
                          onClick={() => void runValuation()}
                          disabled={!selectedPortfolioId || isValuationRunning || !["ADMIN", "ANALYST"].includes(user.role)}
                        >
                          {isValuationRunning ? "Running valuation..." : "Run valuation"}
                        </button>
                        <button
                          className="secondary-button"
                          type="button"
                          onClick={() => void runPerformance()}
                          disabled={!selectedPortfolioId || isPerformanceRunning || !["ADMIN", "ANALYST"].includes(user.role)}
                        >
                          {isPerformanceRunning ? "Refreshing analytics..." : "Refresh analytics"}
                        </button>
                      </div>
                      {user.role === "TRADER" ? (
                        <p className="subtle">Traders can browse holdings data here but cannot run valuation or performance jobs.</p>
                      ) : null}
                    </article>
                  </section>
                </>
              ) : null}

              {activeNav?.id === "portfolios" ? (
                overviewData.portfolios.items.length === 0 ? (
                  <EmptyState
                    title="No portfolios visible"
                    description="This role currently has no portfolio records returned by the backend."
                  />
                ) : (
                  <section className="list-grid">
                    {overviewData.portfolios.items.map((portfolio) => (
                      <article key={portfolio.id} className="list-card">
                        <h3>{portfolio.name}</h3>
                        <p>Base currency: {portfolio.baseCurrency}</p>
                        <p className="subtle">Portfolio ID: {portfolio.id}</p>
                      </article>
                    ))}
                  </section>
                )
              ) : null}

              {activeNav?.id === "securities" ? (
                overviewData.securities.items.length === 0 ? (
                  <EmptyState
                    title="No securities found"
                    description="The security master returned an empty page for the current filter set."
                  />
                ) : (
                  <section className="list-grid">
                    {overviewData.securities.items.map((security) => (
                      <article key={security.id} className="list-card">
                        <h3>{security.ticker}</h3>
                        <p>{security.securityType}</p>
                        <p className="subtle">Currency: {security.currency}</p>
                      </article>
                    ))}
                  </section>
                )
              ) : null}

              {activeNav?.id === "trades" ? (
                overviewData.trades.items.length === 0 ? (
                  <EmptyState
                    title="No recent trades"
                    description="Trade results are empty for this role and pagination window."
                  />
                ) : (
                  <section className="table-shell">
                    <table>
                      <thead>
                        <tr>
                          <th>Side</th>
                          <th>Qty</th>
                          <th>Price</th>
                          <th>Date</th>
                          <th>Currency</th>
                        </tr>
                      </thead>
                      <tbody>
                        {overviewData.trades.items.map((trade) => (
                          <tr key={trade.id}>
                            <td>{trade.side}</td>
                            <td>{formatNumber(trade.quantity)}</td>
                            <td>{formatNumber(trade.price)}</td>
                            <td>{new Date(trade.tradeDate).toLocaleDateString()}</td>
                            <td>{trade.currency}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </section>
                )
              ) : null}

              {activeNav?.id === "valuation" ? (
                valuationResult ? (
                  <section className="metrics-grid">
                    <DataCard title="As of" value={new Date(valuationResult.asOf).toLocaleString()} hint="Most recent valuation run from the backend." />
                    <DataCard title="Total value" value={`${formatNumber(valuationResult.totalValue)} ${valuationResult.currency}`} hint="Multi-currency valuation normalized into base currency." />
                    <DataCard title="Securities value" value={`${formatNumber(valuationResult.securitiesValue)} ${valuationResult.currency}`} hint="Reconstructed from the trade ledger and latest market data." />
                    <DataCard title="Cash value" value={`${formatNumber(valuationResult.cashValue)} ${valuationResult.currency}`} hint="Snapshot payload returned by /api/v1/valuations/run." />
                  </section>
                ) : (
                  <EmptyState
                    title="No valuation run yet"
                    description="Use the protected action button from the Overview tab to create a fresh valuation snapshot."
                  />
                )
              ) : null}

              {activeNav?.id === "performance" ? (
                performanceResult ? (
                  <section className="metrics-grid">
                    <DataCard title="TWR" value={formatPercent(performanceResult.twr)} hint="Time-weighted return." />
                    <DataCard title="MWR" value={formatPercent(performanceResult.mwr)} hint="Money-weighted return approximation." />
                    <DataCard title="Drawdown" value={formatPercent(performanceResult.drawdown)} hint="Maximum drawdown metric." />
                    <DataCard title="Rolling volatility" value={formatPercent(performanceResult.rollingVolatility)} hint="Trailing volatility from the analytics engine." />
                    <DataCard title="Benchmark spread" value={formatPercent(performanceResult.benchmarkSpread)} hint="Portfolio TWR minus configured benchmark return." />
                    <DataCard title="Top position weight" value={formatPercent(performanceResult.topPositionWeight)} hint="Concentration indicator from latest position snapshots." />
                  </section>
                ) : (
                  <EmptyState
                    title="No analytics refresh yet"
                    description="Run the analytics refresh from the Overview tab to populate this workspace."
                  />
                )
              ) : null}

              {activeNav?.id === "admin" ? (
                <section className="action-card">
                  <h3>Admin operating notes</h3>
                  <ul>
                    <li>The shell trusts the role returned by <code>/api/v1/auth/me</code>.</li>
                    <li>MFA enrollment is persisted on the backend after first successful code verification.</li>
                    <li>Subsequent logins reuse the stored MFA secret and skip enrollment.</li>
                  </ul>
                </section>
              ) : null}
            </>
          ) : null}
        </section>
      </div>
    </main>
  );
}
