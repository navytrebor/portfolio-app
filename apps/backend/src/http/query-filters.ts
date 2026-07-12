import { z } from "zod";

const securityFilterSchema = z.object({
  ticker: z.string().trim().min(1).optional(),
  currency: z.string().trim().min(1).optional(),
  securityType: z.string().trim().min(1).optional(),
});

const tradeFilterSchema = z.object({
  portfolioId: z.string().uuid().optional(),
});

export type SecurityFilters = z.infer<typeof securityFilterSchema>;
export type TradeFilters = z.infer<typeof tradeFilterSchema>;

export function parseSecurityFilters(input: unknown): SecurityFilters {
  return securityFilterSchema.parse(input);
}

export function parseTradeFilters(input: unknown): TradeFilters {
  return tradeFilterSchema.parse(input);
}