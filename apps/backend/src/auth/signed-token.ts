import { createHmac, timingSafeEqual } from "node:crypto";
import { env } from "../config/env";

type SignedTokenPayload = Record<string, unknown> & {
  exp?: number;
};

function signTokenPayload(payload: string): string {
  return createHmac("sha256", env.AUTH_TOKEN_SECRET).update(payload).digest("base64url");
}

export function createSignedToken<T extends SignedTokenPayload>(payload: T): string {
  const encodedPayload = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${encodedPayload}.${signTokenPayload(encodedPayload)}`;
}

export function parseSignedToken<T extends SignedTokenPayload>(token: string): T | null {
  const [payloadSegment, signatureSegment, ...rest] = token.split(".");
  if (!payloadSegment || !signatureSegment || rest.length > 0) {
    return null;
  }

  const expectedSignature = signTokenPayload(payloadSegment);
  try {
    if (
      !timingSafeEqual(Buffer.from(signatureSegment), Buffer.from(expectedSignature))
    ) {
      return null;
    }
  } catch {
    return null;
  }

  try {
    const parsed = JSON.parse(Buffer.from(payloadSegment, "base64url").toString("utf8")) as T;
    if (typeof parsed.exp === "number" && parsed.exp < Date.now()) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}