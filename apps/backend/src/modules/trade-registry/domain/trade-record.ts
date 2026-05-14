export type TradeRecord = {
  id: string;
  portfolioId: string;
  securityId: string;
  side: "BUY" | "SELL";
  quantity: number;
  price: number;
  tradeDate: string;
  currency: string;
  createdAt: string;
};

export type RegisterTradeInput = {
  idempotencyKey: string;
  portfolioId: string;
  securityId: string;
  side: "BUY" | "SELL";
  quantity: number;
  price: number;
  tradeDate: string;
  currency: string;
};
