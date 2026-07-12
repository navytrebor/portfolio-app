import type { User } from "../domain/user";
import type { UserRepository } from "../repositories/user-repository";

export class InMemoryUserRepository implements UserRepository {
  private readonly byId = new Map<string, User>();

  seed(user: User) {
    this.byId.set(user.id, user);
  }

  async findById(id: string): Promise<User | null> {
    return this.byId.get(id) ?? null;
  }

  async findByEmail(email: string): Promise<User | null> {
    const normalized = email.trim().toLowerCase();
    for (const user of this.byId.values()) {
      if (user.email.toLowerCase() === normalized) {
        return user;
      }
    }
    return null;
  }

  async saveMfaSecret(userId: string, secret: string): Promise<User | null> {
    const existing = this.byId.get(userId);
    if (!existing) {
      return null;
    }

    const updated: User = {
      ...existing,
      mfaSecret: secret,
      mfaEnrolledAt: new Date().toISOString(),
    };

    this.byId.set(userId, updated);
    return updated;
  }
}
