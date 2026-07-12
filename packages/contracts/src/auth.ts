import { z } from "zod";

export const userRoleSchema = z.enum(["ADMIN", "TRADER", "ANALYST", "VIEWER"]);
export type UserRole = z.infer<typeof userRoleSchema>;

export const authUserSchema = z.object({
  id: z.string().uuid(),
  email: z.string().email(),
  role: userRoleSchema,
  mfaEnabled: z.boolean(),
});

export type AuthUser = z.infer<typeof authUserSchema>;

export const authLoginInitiateRequestSchema = z.object({
  email: z.string().email(),
});

export type AuthLoginInitiateRequest = z.infer<typeof authLoginInitiateRequestSchema>;

export const authLoginNextStepSchema = z.enum(["MFA_ENROLL", "MFA_VERIFY"]);
export type AuthLoginNextStep = z.infer<typeof authLoginNextStepSchema>;

export const authLoginInitiateResponseSchema = z.object({
  nextStep: authLoginNextStepSchema,
  user: authUserSchema,
  expiresAt: z.string().datetime(),
  challengeToken: z.string().optional(),
  enrollmentToken: z.string().optional(),
  mfaSecret: z.string().optional(),
  otpAuthUrl: z.string().optional(),
});

export type AuthLoginInitiateResponse = z.infer<typeof authLoginInitiateResponseSchema>;

export const authMfaEnrollRequestSchema = z.object({
  enrollmentToken: z.string().min(1),
  code: z.string().regex(/^\d{6}$/),
});

export type AuthMfaEnrollRequest = z.infer<typeof authMfaEnrollRequestSchema>;

export const authLoginVerifyRequestSchema = z.object({
  challengeToken: z.string().min(1),
  code: z.string().regex(/^\d{6}$/),
});

export type AuthLoginVerifyRequest = z.infer<typeof authLoginVerifyRequestSchema>;

export const authSessionResponseSchema = z.object({
  token: z.string().min(1),
  user: authUserSchema,
});

export type AuthSessionResponse = z.infer<typeof authSessionResponseSchema>;