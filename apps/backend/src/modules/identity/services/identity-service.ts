import type { User } from "../domain/user";
import type { UserRepository } from "../repositories/user-repository";

export class IdentityService {
  constructor(private readonly users: UserRepository) {}

  async getUser(id: string): Promise<User | null> {
    return this.users.findById(id);
  }
}
