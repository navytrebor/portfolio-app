import { createAuthToken, type AuthenticatedContext } from "../../../auth/request-auth";
import { createSignedToken, parseSignedToken } from "../../../auth/signed-token";
import { authenticationRequired, forbidden } from "../../../http/api-errors";
import { createOtpAuthUrl, generateMfaSecret, verifyTotpCode } from "./mfa-totp";
import type { User } from "../domain/user";
import type { UserRepository } from "../repositories/user-repository";

type LoginChallengePayload = {
  kind: "mfa-verify";
  userId: string;
  exp: number;
};

type EnrollmentChallengePayload = {
  kind: "mfa-enroll";
  userId: string;
  secret: string;
  exp: number;
};

export type AuthenticatedUserView = {
  id: string;
  email: string;
  role: User["role"];
  mfaEnabled: boolean;
};

export type LoginInitiationResult =
  | {
      nextStep: "MFA_ENROLL";
      user: AuthenticatedUserView;
      expiresAt: string;
      enrollmentToken: string;
      mfaSecret: string;
      otpAuthUrl: string;
    }
  | {
      nextStep: "MFA_VERIFY";
      user: AuthenticatedUserView;
      expiresAt: string;
      challengeToken: string;
    };

export type SessionResult = {
  token: string;
  user: AuthenticatedUserView;
};

const CHALLENGE_TTL_MS = 10 * 60 * 1000;

function toUserView(user: User): AuthenticatedUserView {
  return {
    id: user.id,
    email: user.email,
    role: user.role,
    mfaEnabled: Boolean(user.mfaSecret),
  };
}

export class IdentityService {
  constructor(private readonly users: UserRepository) {}

  async getUser(id: string): Promise<User | null> {
    return this.users.findById(id);
  }

  async getUserByEmail(email: string): Promise<User | null> {
    return this.users.findByEmail(email.trim().toLowerCase());
  }

  async startLogin(email: string): Promise<LoginInitiationResult> {
    const user = await this.getUserByEmail(email);
    if (!user) {
      throw authenticationRequired("Unknown email address");
    }

    const expiresAt = new Date(Date.now() + CHALLENGE_TTL_MS).toISOString();
    if (!user.mfaSecret) {
      const secret = generateMfaSecret();
      return {
        nextStep: "MFA_ENROLL",
        user: toUserView(user),
        expiresAt,
        enrollmentToken: createSignedToken<EnrollmentChallengePayload>({
          kind: "mfa-enroll",
          userId: user.id,
          secret,
          exp: Date.now() + CHALLENGE_TTL_MS,
        }),
        mfaSecret: secret,
        otpAuthUrl: createOtpAuthUrl(user.email, secret),
      };
    }

    return {
      nextStep: "MFA_VERIFY",
      user: toUserView(user),
      expiresAt,
      challengeToken: createSignedToken<LoginChallengePayload>({
        kind: "mfa-verify",
        userId: user.id,
        exp: Date.now() + CHALLENGE_TTL_MS,
      }),
    };
  }

  async completeMfaEnrollment(enrollmentToken: string, code: string): Promise<SessionResult> {
    const payload = parseSignedToken<EnrollmentChallengePayload>(enrollmentToken);
    if (!payload || payload.kind !== "mfa-enroll") {
      throw authenticationRequired("MFA enrollment has expired. Restart login.");
    }

    if (!verifyTotpCode(payload.secret, code)) {
      throw forbidden("Invalid MFA code. Check the authenticator code and try again.");
    }

    const user = await this.users.saveMfaSecret(payload.userId, payload.secret);
    if (!user) {
      throw authenticationRequired("User no longer exists. Restart login.");
    }

    return this.createSession(user);
  }

  async verifyLoginChallenge(challengeToken: string, code: string): Promise<SessionResult> {
    const payload = parseSignedToken<LoginChallengePayload>(challengeToken);
    if (!payload || payload.kind !== "mfa-verify") {
      throw authenticationRequired("Login challenge has expired. Restart login.");
    }

    const user = await this.users.findById(payload.userId);
    if (!user?.mfaSecret) {
      throw authenticationRequired("MFA is not enrolled for this user. Restart login.");
    }

    if (!verifyTotpCode(user.mfaSecret, code)) {
      throw forbidden("Invalid MFA code. Check the authenticator code and try again.");
    }

    return this.createSession(user);
  }

  createSession(user: User): SessionResult {
    const context: AuthenticatedContext = {
      userId: user.id,
      role: user.role,
    };

    return {
      token: createAuthToken(context),
      user: toUserView(user),
    };
  }

  async getAuthenticatedUserView(id: string): Promise<AuthenticatedUserView | null> {
    const user = await this.getUser(id);
    return user ? toUserView(user) : null;
  }
}
