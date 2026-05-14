import { z } from "zod";

export const tradeSchema = z.object({
  id: z.string().uuid(),
  portfolioId: z.string().uuid(),
  securityId: z.string().uuid(),
  side: z.enum(["BUY", "SELL"]),
  quantity: z.number().positive(),
  price: z.number().positive(),
  tradeDate: z.string().datetime(),
  currency: z.string().length(3),
});

export type Trade = z.infer<typeof tradeSchema>;

export const createTradeRequestSchema = tradeSchema.omit({ id: true });
export type CreateTradeRequest = z.infer<typeof createTradeRequestSchema>;
