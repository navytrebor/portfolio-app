import assert from "node:assert/strict";
import { Pool } from "pg";
import { env } from "../config/env";
import { generateTotpCode } from "../modules/identity/services/mfa-totp";

const REQUEST_TIMEOUT_MS = 10_000;
const EMAIL = "alice@example.com";

type LoginInitiateResponse = {
  nextStep: "MFA_ENROLL" | "MFA_VERIFY";
  expiresAt: string;
  enrollmentToken?: string;
  challengeToken?: string;
  mfaSecret?: string;
  user: {
    id: string;
    email: string;
    role: string;
    mfaEnabled: boolean;
  };
};

function apiBaseUrl(): string {
  return process.env.API_BASE_URL ?? `http://127.0.0.1:${env.PORT}`;
}

async function callApi(path: string, options: RequestInit): Promise<{ status: number; body: unknown }> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(`${apiBaseUrl()}${path}`, {
      ...options,
      signal: controller.signal,
    });

    const text = await response.text();
    return {
      status: response.status,
      body: text.length > 0 ? JSON.parse(text) : null,
    };
  } finally {
    clearTimeout(timeout);
  }
}

async function lookupStoredSecret(pool: Pool, email: string): Promise<string | null> {
  const result = await pool.query<{ mfa_secret: string | null }>(
    `SELECT mfa_secret FROM users WHERE lower(email) = lower($1)`,
    [email],
  );

  return result.rows[0]?.mfa_secret ?? null;
}

async function run() {
  const pool = new Pool({
    host: env.POSTGRES_HOST,
    port: env.POSTGRES_PORT,
    database: env.POSTGRES_DB,
    user: env.POSTGRES_USER,
    password: env.POSTGRES_PASSWORD,
    ssl: env.POSTGRES_SSL ? { rejectUnauthorized: false } : false,
  });

  try {
    const initiate = await callApi("/api/v1/auth/login/initiate", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: EMAIL }),
    });

    assert.equal(initiate.status, 200, "Expected login initiation to succeed");
    const initiateBody = initiate.body as LoginInitiateResponse;
    assert.equal(initiateBody.user.email, EMAIL, "Expected initiated user email");

    let token = "";

    if (initiateBody.nextStep === "MFA_ENROLL") {
      assert.ok(initiateBody.enrollmentToken, "Expected enrollment token");
      assert.ok(initiateBody.mfaSecret, "Expected MFA secret");

      const enroll = await callApi("/api/v1/auth/mfa/enroll", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          enrollmentToken: initiateBody.enrollmentToken,
          code: generateTotpCode(initiateBody.mfaSecret),
        }),
      });

      assert.equal(enroll.status, 200, "Expected MFA enrollment completion to succeed");
      token = (enroll.body as { token: string }).token;
    } else {
      assert.ok(initiateBody.challengeToken, "Expected MFA verify challenge token");
      const secret = await lookupStoredSecret(pool, EMAIL);
      assert.ok(secret, "Expected stored MFA secret for verify flow");

      const verify = await callApi("/api/v1/auth/login/verify", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          challengeToken: initiateBody.challengeToken,
          code: generateTotpCode(secret),
        }),
      });

      assert.equal(verify.status, 200, "Expected MFA login verification to succeed");
      token = (verify.body as { token: string }).token;
    }

    const me = await callApi("/api/v1/auth/me", {
      method: "GET",
      headers: {
        authorization: `Bearer ${token}`,
      },
    });

    assert.equal(me.status, 200, "Expected auth/me to return 200");
    const meBody = me.body as {
      user?: { email?: string; role?: string; mfaEnabled?: boolean };
    };
    assert.equal(meBody.user?.email, EMAIL, "Expected auth/me to return signed-in user");
    assert.equal(meBody.user?.mfaEnabled, true, "Expected MFA to be enabled after login flow");

    console.log("auth-shell-smoke: ok");
    console.log(
      JSON.stringify(
        {
          baseUrl: apiBaseUrl(),
          email: EMAIL,
          role: meBody.user?.role,
          nextStep: initiateBody.nextStep,
        },
        null,
        2,
      ),
    );
  } finally {
    await pool.end();
  }
}

run().catch((error) => {
  console.error("auth-shell-smoke: failed", error);
  process.exitCode = 1;
});