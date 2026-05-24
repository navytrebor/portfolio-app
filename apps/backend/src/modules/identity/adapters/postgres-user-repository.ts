import type { Pool } from "pg";
import type { User } from "../domain/user";
import type { UserRepository } from "../repositories/user-repository";

type UserRow = {
  id: string;
  email: string;
  created_at: Date;
};

function rowToUser(row: UserRow): User {
  return {
    id: row.id,
    email: row.email,
    createdAt: row.created_at.toISOString(),
  };
}

export class PostgresUserRepository implements UserRepository {
  constructor(private readonly pool: Pool) {}

  async findById(id: string): Promise<User | null> {
    const result = await this.pool.query<UserRow>(
      `
      SELECT id, email, created_at
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
}
