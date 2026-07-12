import type { Pool } from "pg";
import type { User } from "../domain/user";
import type { UserRepository } from "../repositories/user-repository";

type UserRow = {
  id: string;
  email: string;
  role: string;
  mfa_secret: string | null;
  mfa_enrolled_at: Date | null;
  created_at: Date;
};

function rowToUser(row: UserRow): User {
  return {
    id: row.id,
    email: row.email,
    role: row.role as User["role"],
    mfaSecret: row.mfa_secret,
    mfaEnrolledAt: row.mfa_enrolled_at?.toISOString() ?? null,
    createdAt: row.created_at.toISOString(),
  };
}

export class PostgresUserRepository implements UserRepository {
  constructor(private readonly pool: Pool) {}

  async findById(id: string): Promise<User | null> {
    const result = await this.pool.query<UserRow>(
      `
      SELECT id, email, role, mfa_secret, mfa_enrolled_at, created_at
      FROM users
      WHERE id = $1
      `,
      [id],
    );

    if ((result.rowCount ?? 0) === 0) {
      return null;
    }

    return rowToUser(result.rows[0]);
  }

  async findByEmail(email: string): Promise<User | null> {
    const result = await this.pool.query<UserRow>(
      `
      SELECT id, email, role, mfa_secret, mfa_enrolled_at, created_at
      FROM users
      WHERE lower(email) = lower($1)
      `,
      [email],
    );

    if ((result.rowCount ?? 0) === 0) {
      return null;
    }

    return rowToUser(result.rows[0]);
  }

  async saveMfaSecret(userId: string, secret: string): Promise<User | null> {
    const result = await this.pool.query<UserRow>(
      `
      UPDATE users
      SET mfa_secret = $2,
          mfa_enrolled_at = NOW()
      WHERE id = $1
      RETURNING id, email, role, mfa_secret, mfa_enrolled_at, created_at
      `,
      [userId, secret],
    );

    if ((result.rowCount ?? 0) === 0) {
      return null;
    }

    return rowToUser(result.rows[0]);
  }
}
