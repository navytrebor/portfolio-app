import type { User } from "../domain/user";
import type { UserRepository } from "../repositories/user-repository";

export class InMemoryUserRepository implements UserRepository {
  private readonly byId = new Map<string, User>();

  async findById(id: string): Promise<User | null> {
    return this.byId.get(id) ?? null;
  }
}
